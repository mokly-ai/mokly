"""Real HTTP checks of the root-mounted app server, using isolated test files."""

from contextlib import contextmanager
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from support import ROOT


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class AppBuildConfigTests(unittest.TestCase):
    def environment(self):
        return dict(
            os.environ,
            EXPO_PUBLIC_MKC_API_ORIGIN="https://api.example.com",
            EXPO_PUBLIC_MKC_APP_ORIGIN="https://example.com",
            MKC_CATALOGUE_BASE_DOMAIN="catalogues.example",
            MKC_BUILD_SHA="a" * 40,
        )

    def run_config(self, environment, check=True):
        return subprocess.run(
            ["node", str(ROOT / "infra/docker/app-build-config.mjs")],
            env=environment,
            capture_output=True,
            text=True,
            check=check,
            timeout=10,
        )

    def test_origins_catalogue_domain_and_revision_are_baked(self):
        result = self.run_config(self.environment())
        config = json.loads(result.stdout)
        self.assertEqual(config["apiOrigin"], "https://api.example.com")
        self.assertEqual(config["appOrigin"], "https://example.com")
        self.assertEqual(config["catalogueBaseDomain"], "catalogues.example")
        self.assertEqual(config["revision"], "a" * 40)
        self.assertNotIn("basePath", config)
        self.assertNotIn("siteOrigin", config)

    def test_catalogue_domain_is_validated(self):
        environment = self.environment()
        for invalid in (
            "",
            "*.catalogues.example",
            "https://catalogues.example",
            "CATALOGUES.EXAMPLE",
        ):
            with self.subTest(invalid=invalid):
                result = self.run_config(
                    dict(environment, MKC_CATALOGUE_BASE_DOMAIN=invalid), check=False
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("lowercase DNS name", result.stderr)


class AppServerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "index.html").write_text(
            "<!doctype html><html>test application</html>"
        )
        self.asset = "/entry-" + "a" * 32 + ".js"
        (self.root / self.asset[1:]).write_text("console.log('test asset')")
        self.unhashed_asset = "/bundle-" + "b" * 32 + ".js/entry.js"
        (self.root / self.unhashed_asset[1:]).parent.mkdir()
        (self.root / self.unhashed_asset[1:]).write_text(
            "console.log('unhashed asset')"
        )
        self.config = self.root / "config.json"
        self.config.write_text(
            json.dumps(
                dict(
                    apiOrigin="https://api.example.com",
                    appOrigin="https://example.com",
                    catalogueBaseDomain="catalogues.example",
                    revision="a" * 40,
                )
            )
        )
        # Viewer 0.4.0 renders removed previews and comparison panes as srcdoc
        # documents that inherit this policy, so the stylesheets, images and
        # fonts they load from the publication's catalogue host are allowed
        # here, and nothing broader: no other host, and no script source.
        self.csp = (
            "default-src 'self'; frame-src 'self' https://example.com "
            "https://api.example.com https://*.catalogues.example; connect-src 'self' "
            "https://example.com https://api.example.com https://*.catalogues.example; "
            "img-src 'self' data: https://*.catalogues.example; "
            "font-src 'self' https://*.catalogues.example; "
            "style-src 'self' 'unsafe-inline' https://*.catalogues.example; "
            "frame-ancestors 'none'"
        )

    @contextmanager
    def running(self, **overrides):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        environment = dict(
            os.environ,
            MKC_APP_DIRECTORY=str(self.root),
            MKC_APP_BUILD_CONFIG=str(self.config),
            PORT=str(port),
            **overrides,
        )
        process = subprocess.Popen(
            ["node", str(ROOT / "infra/docker/app-server.mjs")],
            env=environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            for _ in range(100):
                if process.poll() is not None:
                    self.fail(process.stderr.read())
                try:
                    self.fetch(port, "/_health")
                    break
                except OSError:
                    time.sleep(0.02)
            else:
                self.fail("Static server did not listen")
            yield port
        finally:
            if process.poll() is None:
                process.terminate()
            process.communicate(timeout=30)

    def fetch(self, port, path, method="GET"):
        request = Request(f"http://127.0.0.1:{port}{path}", method=method)
        with build_opener(NoRedirect()).open(request, timeout=3) as response:
            return response.status, response.headers, response.read()

    def test_root_deep_routes_assets_and_health_are_served(self):
        with self.running() as port:
            root = self.fetch(port, "/")
            for path in ("/sign-in", "/mokly/mokly-cloud/settings", "/app"):
                with self.subTest(path=path):
                    deep = self.fetch(port, path)
                    self.assertEqual(deep[2], root[2])
                    self.assertEqual(
                        deep[1]["content-security-policy"], self.csp
                    )
            asset = self.fetch(port, self.asset)
            self.assertIn("javascript", asset[1]["content-type"])
            self.assertIn("immutable", asset[1]["cache-control"])
            unhashed = self.fetch(port, self.unhashed_asset)
            self.assertEqual(unhashed[1]["cache-control"], "no-cache")
            self.assertEqual(self.fetch(port, self.asset, "HEAD")[2], b"")
            self.assertEqual(
                self.fetch(port, "/_health")[1]["cache-control"], "no-store"
            )
            config = json.loads(self.fetch(port, "/_config")[2])
            self.assertNotIn("basePath", config)
            self.assertNotIn("siteOrigin", config)

    def test_missing_assets_malformed_paths_and_methods_are_not_html(self):
        with self.running() as port:
            for path, method, status in [
                ("/missing.js", "GET", 404),
                ("/%XX", "GET", 400),
                ("/..%2fsecret", "GET", 400),
                ("/", "POST", 405),
            ]:
                with self.subTest(path=path), self.assertRaises(HTTPError) as error:
                    self.fetch(port, path, method)
                self.assertEqual(error.exception.code, status)

    def test_runtime_cannot_retarget_a_built_bundle(self):
        for key, value in [
            ("EXPO_PUBLIC_MKC_API_ORIGIN", "https://elsewhere.invalid"),
            ("MKC_EXPECTED_REVISION", "b" * 40),
        ]:
            with self.subTest(key=key):
                result = subprocess.run(
                    ["node", str(ROOT / "infra/docker/app-server.mjs")],
                    env=dict(
                        os.environ,
                        MKC_APP_DIRECTORY=str(self.root),
                        MKC_APP_BUILD_CONFIG=str(self.config),
                        **{key: value},
                    ),
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("different", result.stderr)


if __name__ == "__main__":
    unittest.main()
