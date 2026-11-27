"""Run the exact published package against live local publication services."""

import json
from pathlib import Path
import re
import subprocess
import tempfile

from publication_smoke_fixture import (
    _build_fixture, _prepare_isolated_checkout, _require_clean_checkout,
    cli_result, fixture_environment, require_dependencies,
)
from publication_smoke_consumer import install_published_cli
from publication_exchange import INDEX
from publication_smoke_support import exchange_catalogue_grant, project_and_token


CAPTURE_FIXTURES = Path("infra/tests/fixtures/catalogue-capture")


def _recorded_refusal(root, category):
    capture = root / CAPTURE_FIXTURES / ("mokly-publish-" + category)
    code = int(capture.with_suffix(".exit.txt").read_text(encoding="utf8"))
    stdout = capture.with_suffix(".stdout.txt").read_bytes()
    stderr = capture.with_suffix(".stderr.txt").read_bytes()
    assert stderr.startswith(f"[mokly/{category}] ".encode()), f"{category}: recording needs its diagnostic headline"
    return code, stdout, stderr


def _require_recorded_refusal(result, root, category):
    """Accept the complete recorded streams after only npm notice or warn lines."""
    code, stdout, stderr = _recorded_refusal(root, category)
    actual = result.stderr.encode("utf8")
    details = f"{category}: {cli_result(result)}"
    assert result.returncode == code, "Recorded exit differs: " + details
    assert result.stdout.encode("utf8") == stdout, "Recorded stdout differs: " + details
    if actual == stderr:
        return
    assert actual.endswith(b"\n" + stderr), "Recorded stderr differs: " + details
    prefix = actual[:-len(stderr)]
    assert all(re.match(rb"^npm (notice|warn)( |$)", line) for line in prefix.splitlines()), "Unexpected stderr prefix: " + details


def _recorded_untracked_path(root):
    _, _, stderr = _recorded_refusal(root, "git-uncommitted")
    paths = [line[4:] for line in stderr.decode("utf8").splitlines() if line.startswith("  - ")]
    assert len(paths) == 1, "git-uncommitted: recording must name exactly one untracked path"
    path = Path(paths[0])
    assert not path.is_absolute() and ".." not in path.parts, "git-uncommitted: recorded path must stay inside the checkout"
    return path


def _publish_command(executable):
    return [str(executable), "publish", "--strict", "--config",
            "mokly.config.json", "--base", "HEAD~1", "--repository", "github.com/mokly-ai/mokly-cloud"]


def _checkout_refusals(api, project, checkout, command, env, root):
    """The real dirty-source refusal matches the recording and sends no Plan."""
    query = "SELECT count(*) FROM publications WHERE project_id='" + project["id"] + "'"
    before = api.sql(query)
    untracked = checkout / _recorded_untracked_path(root)
    untracked.write_text("untracked\n", encoding="utf8")
    try:
        result = subprocess.run(command, cwd=checkout, env=env, capture_output=True, text=True, timeout=480)
        _require_recorded_refusal(result, root, "git-uncommitted")
        assert api.sql(query) == before, cli_result(result)
    finally:
        untracked.unlink()
    _require_clean_checkout(checkout)
    print("PASS git-uncommitted matches its recording and creates no API upload attempt")


def _require_changed_index(index):
    """Count the changed screen using the published index's Changes membership."""
    assert index["schemaVersion"] == 9
    assert index["changesStatus"] == "ready"
    screens = [row for row in index["screens"] if row.get("changes", {}).get("included")]
    assert [(row["path"], row["changes"]["kind"]) for row in screens] == [("publication-smoke", "changed")], "Published index must count the changed screen"


def _stored_envelope(api, project, publication_id):
    """Read the actual admitted envelope from this smoke's local content store."""
    object_path = api.sql("SELECT f.blob_hash || '/' || b.incarnation FROM publication_files f "
                         "JOIN blobs b ON b.hash=f.blob_hash AND b.project_id='" + project["id"] + "' "
                         "WHERE f.publication_id='" + publication_id + "' AND f.path='mokly-upload.json'")
    assert object_path, "Published envelope must be stored"
    return json.loads((Path(api.blobs.name) / "sha256" / object_path).read_bytes())


def _served_build(api, catalogue, owner, project, publication, destination):
    grant, _ = api.call("POST", "/v1/projects/" + project["id"] + "/publications/" + publication["id"] + "/access-grants", {}, owner, 201)
    cookie, _ = exchange_catalogue_grant(catalogue, publication, grant["grant"], api.origin)
    marker = json.loads((destination / ".mokly-export-artifact").read_bytes())
    assert marker["schemaVersion"] == 3
    for entry in marker["files"]:
        path = entry["path"]
        body, _ = catalogue.fetch(publication, "/" + path, cookie=cookie)
        assert body == (destination / path).read_bytes(), path
    body, _ = catalogue.fetch(publication, "/missing", cookie=cookie, expected=404)
    assert body == (destination / "404.html").read_bytes()
    body, _ = catalogue.fetch(publication, "/view/publication-smoke/", cookie=cookie)
    assert body == (destination / "view/publication-smoke/index.html").read_bytes()
    _, headers = catalogue.fetch(publication, "/view/publication-smoke?view=changes", cookie=cookie, expected=308)
    assert headers["location"] == "/view/publication-smoke/?view=changes"
    screens, _ = api.call("GET", "/v1/projects/" + project["id"] + "/publications/" + publication["id"] + "/screens", session=owner)
    assert screens == {"items": [{"path": "publication-smoke", "title": "Publication smoke", "views": [
        {"viewport": "desktop", "colorScheme": "light"}, {"viewport": "mobile", "colorScheme": "light"}]}], "nextCursor": None}


def cli_smoke(api, catalogue, owner):
    root = Path(__file__).resolve().parents[2]
    require_dependencies(root)
    temporary_root = root / ".context"
    temporary_root.mkdir(parents=True, exist_ok=True)
    workspace, project, token = project_and_token(api, owner, "Published CLI")
    try:
        with tempfile.TemporaryDirectory(prefix="publication-smoke-", dir=temporary_root) as scratch:
            published_cli = install_published_cli(Path(scratch))
            checkout = _prepare_isolated_checkout(root, Path(scratch), published_cli)
            destination = _build_fixture(checkout, published_cli, checkout / ".context/export", "HEAD~1")
            index = json.loads((destination / INDEX).read_bytes())
            _require_changed_index(index)
            env = dict(fixture_environment(Path(scratch)), MOKLY_ENDPOINT=api.url + "/v1/projects/" + project["id"] + "/publications", MOKLY_TOKEN=token["secret"])
            command = _publish_command(published_cli.executable)
            output = subprocess.run(command, cwd=checkout, env=env, capture_output=True, text=True, timeout=480)
            assert output.returncode == 0, cli_result(output)
            assert "Published Mokly catalogue." in output.stdout, cli_result(output)
            assert token["secret"] not in output.stdout + output.stderr, cli_result(output)
            publication_id = api.sql("SELECT id FROM publications WHERE project_id='" + project["id"] + "' AND state='ready'")
            assert publication_id, cli_result(output)
            manifest = _stored_envelope(api, project, publication_id)
            assert manifest["moklyVersion"] == published_cli.version, cli_result(output)
            assert manifest["schemaVersion"] == 3, cli_result(output)
            assert "comparisonPath" not in manifest, cli_result(output)
            assert manifest["baseRef"] == "HEAD~1" and manifest["baseSha"] == index["baseCommit"], cli_result(output)
            publication = {"id": publication_id, "catalogueUrl": "http://p-" + publication_id + ".localhost:8082"}
            _served_build(api, catalogue, owner, project, publication, destination)
            _require_clean_checkout(checkout)
            repeated = subprocess.run(command, cwd=checkout, env=env, capture_output=True, text=True, timeout=480)
            assert repeated.returncode == 0, cli_result(repeated)
            assert "Mokly catalogue already published for this commit." in repeated.stdout, cli_result(repeated)
            assert api.sql("SELECT count(*) FROM publications WHERE project_id='" + project["id"] + "' AND state='ready'") == "1", cli_result(repeated)
            _checkout_refusals(api, project, checkout, command, env, root)
            print("PASS " + " ".join(command))
            print("PASS every served build file matches a strict build of the same checkout and base")
            print("PASS changed screen listing and repeated publication identity")
    finally:
        api.call("DELETE", "/v1/workspaces/" + workspace["id"], {"confirmationName": workspace["name"], "version": 1}, owner, 204)
