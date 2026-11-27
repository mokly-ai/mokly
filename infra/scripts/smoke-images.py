"""Run trusted local BuildKit archives as UID 65532 without a Docker daemon.

Requires Linux, passwordless sudo, crane, psql and a disposable native Postgres
database. This is local image evidence, not a cloud deployment. Never run this
script against archives from an untrusted source.
"""

import json
from html.parser import HTMLParser
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tarfile
import tempfile
import time
from urllib.error import URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import urlopen
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/cloud"))
from smoke_support import Api
from publication_exchange import ENVELOPE, INDEX, MARKER, publish
from publication_smoke_support import (
    Catalogue, exchange_catalogue_grant, files_from_tar, fixture_mokly_version, project_and_token,
)


def command(args, **options):
    return subprocess.run(args, check=True, timeout=options.pop("timeout", 60), **options)


def publication_fixture():
    """Read the regenerated package fixture before the image upload exchange."""
    files = files_from_tar((ROOT / "crates/mkc-mokly-contract/fixtures/dogfood.tar.gz").read_bytes())
    envelope = json.loads(files[ENVELOPE])
    assert envelope["schemaVersion"] == 3
    assert envelope["moklyVersion"] == fixture_mokly_version(ROOT)
    assert json.loads(files[MARKER])["schemaVersion"] == 3
    index = json.loads(files[INDEX])
    assert index["schemaVersion"] == 9
    assert re.fullmatch(r"mokly-viewer/diffs/generations/[a-f0-9]{64}/", index["comparisonUrl"])
    assert index["baseCommit"] == envelope["baseSha"]
    assert "comparisonPath" not in envelope
    return files


def unpack(name, directory):
    archive = ROOT / ".context/images" / (name + ".tar")
    with tarfile.open(archive) as source:
        manifest = json.load(source.extractfile("manifest.json"))[0]
        config = json.load(source.extractfile(manifest["Config"]))["config"]
    assert config["User"] == "65532:65532", config
    assert config["StopSignal"] == "SIGINT", config
    root = directory / name
    root.mkdir()
    with archive.open("rb") as source:
        command(["crane", "export", "-", str(directory / (name + "-root.tar"))], stdin=source)
    command(["tar", "--no-same-owner", "-xf", str(directory / (name + "-root.tar")), "-C", str(root)])
    return root, config


def inside(root, config, args=None):
    return ["sudo", "-E", "chroot", "--userspec=65532:65532", str(root)] + config["Entrypoint"] + (args if args is not None else config.get("Cmd", []))


def stop(process):
    if process.poll() is None:
        command(["sudo", "kill", "-INT", str(process.pid)])
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            command(["sudo", "kill", "-KILL", str(process.pid)])
            process.wait(timeout=5)
    assert process.returncode == 0, ("image shutdown", process.returncode)


def hashed_asset(path):
    return bool(re.search(r"[-.][a-f0-9]{16,}[.]", path.name))


class RobotsParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.noindex = False

    def handle_starttag(self, tag, attrs):
        attributes = {name.lower(): value for name, value in attrs}
        if tag.lower() != "meta" or (attributes.get("name") or "").lower() != "robots":
            return
        directives = re.split(r"[\s,]+", (attributes.get("content") or "").lower())
        self.noindex = "noindex" in directives


def has_noindex(document):
    parser = RobotsParser()
    parser.feed(document.decode("utf-8"))
    return parser.noindex


def app_smoke(root, config, directory):
    build = json.loads((root / "app/build-config.json").read_text())
    assert "basePath" not in build, build
    prefix = ""
    catalogue = "https://*." + build["catalogueBaseDomain"]
    csp = (f"default-src 'self'; frame-src 'self' {build['appOrigin']} {build['apiOrigin']} {catalogue}; "
           f"connect-src 'self' {build['appOrigin']} {build['apiOrigin']} {catalogue}; "
           f"img-src 'self' data: {catalogue}; font-src 'self' {catalogue}; "
           f"style-src 'self' 'unsafe-inline' {catalogue}; frame-ancestors 'none'")
    environment = dict(os.environ, PORT="18083", MKC_EXPECTED_REVISION=build["revision"])
    for kind in ("app", "api"):
        environment["EXPO_PUBLIC_MKC_" + kind.upper() + "_ORIGIN"] = build[kind + "Origin"]
    with (directory / "app.log").open("w") as log:
        process = subprocess.Popen(inside(root, config), env=environment, stdout=log, stderr=log)
        try:
            for attempt in range(50):
                try:
                    with urlopen("http://127.0.0.1:18083/_health", timeout=2) as response:
                        assert json.load(response) == {"status": "ok"}
                    break
                except URLError:
                    assert process.poll() is None, (directory / "app.log").read_text()
                    time.sleep(0.1)
            else:
                raise AssertionError("App image health timed out")
            bodies = []
            for route in (prefix + "/", prefix + "/sign-in",
                          prefix + "/mokly/mokly-cloud/settings"):
                with urlopen("http://127.0.0.1:18083" + route, timeout=5) as response:
                    assert response.status == 200
                    assert response.headers["Content-Type"].startswith("text/html")
                    assert response.headers["Content-Security-Policy"] == csp
                    bodies.append(response.read())
            document = (root / "app/dist/index.html").read_bytes()
            assert all(body == document and has_noindex(body) for body in bodies)
            asset = next(path for path in (root / "app/dist").rglob("*.js") if hashed_asset(path))
            route = prefix + "/" + asset.relative_to(root / "app/dist").as_posix()
            with urlopen("http://127.0.0.1:18083" + route, timeout=5) as response:
                assert response.read() == asset.read_bytes()
                assert response.headers["Cache-Control"] == "public, max-age=31536000, immutable"
            assert (root / "app/dist/folio").is_dir()
            print(f"PASS app image: /_health, {prefix or '/'}, sign-in, deep slug settings, noindex, CSP, hashed asset, synced Folio styles", flush=True)
        finally:
            stop(process)


def rust_smoke(api_root, api_config, catalogue_root, catalogue_config, directory):
    database = os.environ["MKC_TEST_DATABASE_URL"].replace("localhost", "127.0.0.1")
    schema = "image_smoke_" + uuid.uuid4().hex
    command(["psql", database, "-v", "ON_ERROR_STOP=1", "-c", "CREATE SCHEMA " + schema], stdout=subprocess.DEVNULL)
    separator = "&" if "?" in database else "?"
    scoped = database + separator + "options=-csearch_path%3D" + schema
    reader = "catalogue_" + uuid.uuid4().hex
    password = secrets.token_hex(24)
    environment = dict(os.environ, MKC_DATABASE_URL=scoped)
    api = catalogue = None
    try:
        result = command(inside(api_root, api_config, ["migrate"]), env=environment, capture_output=True, text=True)
        assert result.returncode == 0
        signing = secrets.token_hex(32)
        for root in (api_root, catalogue_root):
            (root / "run/mokly-secrets").mkdir(parents=True, exist_ok=True)
            key = root / "run/mokly-secrets/catalogue-signing-key"
            key.write_text(signing)
            key.chmod(0o444)
            (root / "blobs").mkdir()
            command(["sudo", "chown", "65532:65532", str(root / "blobs")])
        api = Api("unused", command=inside(api_root, api_config), overrides={
            "MKC_DATABASE_URL": scoped, "MKC_FILE_STORE_ROOT": "/blobs",
            "MKC_CATALOGUE_SIGNING_KEY": "", "MKC_TRUSTED_PROXY_HOPS": "0",
        })
        health, _ = api.call("GET", "/v1/health")
        assert health["migrations"] == "current"
        sql = f"""CREATE ROLE {reader} LOGIN PASSWORD '{password}';
            GRANT USAGE, CREATE ON SCHEMA {schema} TO {reader};
            GRANT SELECT ON ALL TABLES IN SCHEMA {schema} TO {reader};
            GRANT DELETE ON {schema}.catalogue_grants TO {reader};"""
        command(["psql", database, "-v", "ON_ERROR_STOP=1", "-f", "-"], input=sql, text=True, stdout=subprocess.DEVNULL)
        address = urlsplit(scoped)
        reader_url = urlunsplit(address._replace(netloc=f"{reader}:{password}@{address.hostname}:{address.port or 5432}"))
        catalogue = Api("unused", command=inside(catalogue_root, catalogue_config), overrides=dict(
            api.environment, MKC_DATABASE_URL=reader_url, MKC_CATALOGUE_BIND="127.0.0.1:0"))
        with urlopen(catalogue.url + "/_health", timeout=5) as response:
            assert response.status == 200 and response.read() == b"ok"
            assert response.headers["Cache-Control"] == "no-store"
        Catalogue.fetch(catalogue, {}, host="smoke-image.localhost:8082", origin=api.origin, expected=404)
        owner = api.signup()
        _, project, token = project_and_token(api, owner, "Image smoke")
        fixture = publication_fixture()
        publication = publish(api, project, token["secret"], fixture)
        command(["sudo", "cp", "-a", str(api_root / "blobs/.") + "/.", str(catalogue_root / "blobs")])
        grant, _ = api.call("POST", "/v1/projects/" + project["id"] + "/publications/" + publication["id"] + "/access-grants", {}, owner, 201)
        cookie, _ = exchange_catalogue_grant(catalogue, publication, grant["grant"], api.origin)
        data, _ = Catalogue.fetch(catalogue, publication, "/index.html", cookie=cookie, origin=api.origin)
        assert data == fixture["index.html"]
        generation = json.loads(fixture[INDEX])["comparisonUrl"]
        snapshot = next(path for path in fixture if path.startswith(generation + "snapshots/") and path.endswith(".html"))
        for path in [INDEX, "mokly-viewer/entries/start.json", snapshot, "view/start/index.html"]:
            route = "/view/start/" if path == "view/start/index.html" else "/" + path
            data, headers = Catalogue.fetch(catalogue, publication, route, cookie=cookie, origin=api.origin)
            assert data == fixture[path] and headers["cache-control"] == "no-store"
        for subcommand in ("prune", "publication-check-status"):
            result = command(inside(api_root, api_config, [subcommand]), env=environment, capture_output=True, text=True)
            events = [json.loads(line)["fields"] for line in result.stdout.splitlines() if line.startswith("{")]
            assert any(event.get("message") == ("authentication records pruned" if subcommand == "prune" else "publication check status") for event in events), result.stdout
        print("PASS API/catalogue images: migrate, health, unknown host, signed private grant, exact publication bytes, prune, dead-letter count", flush=True)
    finally:
        for service in (catalogue, api):
            if service:
                stop(service.process)
                service.blobs.cleanup()
        command(["psql", database, "-v", "ON_ERROR_STOP=1", "-c", "DROP SCHEMA " + schema + " CASCADE"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        command(["psql", database, "-v", "ON_ERROR_STOP=1", "-c", "DROP ROLE IF EXISTS " + reader], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    if sys.argv[1:]:
        raise SystemExit("Usage: smoke-images.py")
    os.environ["MKC_TEST_DATABASE_URL"]
    scratch = ROOT / ".context"
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="image-smoke-", dir=scratch) as temporary:
        directory = Path(temporary)
        directory.chmod(0o755)
        try:
            api_root, api_config = unpack("mkc-api", directory)
            catalogue_root, catalogue_config = unpack("mkc-catalogue-server", directory)
            app_root, app_config = unpack("app", directory)
            rust_smoke(api_root, api_config, catalogue_root, catalogue_config, directory)
            app_smoke(app_root, app_config, directory)
            print("PASS all three image filesystems ran as UID/GID 65532 with SIGINT shutdown", flush=True)
        finally:
            command(["sudo", "rm", "-rf", str(directory)], timeout=600)


if __name__ == "__main__":
    main()
