"""Real catalogue server and rollout admission in both desktop flag states."""

import json
from pathlib import Path
import sys
from unittest import TestCase
import urllib.error
import urllib.request
import uuid

from smoke_support import Api


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "infra/scripts"))

import smoke_admission as admission
from smoke import HttpClient


DESKTOP = json.loads((ROOT / "fixtures/desktop-origin.json").read_text())["origin"]


def read_frame_ancestors(csp):
    return [part.strip().split()[1:] for part in csp.split(";")
            if part.strip().startswith("frame-ancestors ")]


def check_rollout_admission(server, enabled):
    client = HttpClient()
    url = server.url + "/"
    app = server.origin
    response = client.get(url, app)
    assert response.status == 404, response.status
    actual = read_frame_ancestors(response.headers["content-security-policy"])
    expected = [admission.frame_ancestors(app, enabled)]
    assert actual == expected, (enabled, actual, expected)
    admission.catalogue_headers(response.headers, app, enabled)
    admission.cors(client, url, app, enabled, "Catalogue", 404)

    assertions = TestCase()
    with assertions.assertRaisesRegex(ValueError, "frame-ancestors mismatch.*MKC_DESKTOP_CLIENT"):
        admission.catalogue_headers(response.headers, app, not enabled)
    with assertions.assertRaisesRegex(ValueError, "CORS mismatch.*MKC_DESKTOP_CLIENT"):
        admission.cors(client, url, app, not enabled, "Catalogue", 404)


def smoke(executable, enabled):
    app = Api(executable, overrides={"MKC_DESKTOP_CLIENT": str(enabled).lower(),
                                     "MKC_CATALOGUE_BIND": "127.0.0.1:0"},
              isolated_database=True)
    try:
        expected = ["'self'", app.origin] + ([DESKTOP] if enabled else [])
        for origin in [app.origin, DESKTOP, "https://third.example.com", "null", None]:
            admitted = origin == app.origin or enabled and origin == DESKTOP
            for method, path, status in [("GET", "/_health", 200), ("HEAD", "/_health", 200),
                                         ("GET", "/", 404), ("HEAD", "/", 404),
                                         ("OPTIONS", "/_access", 200),
                                         ("POST", "/_access", 401 if admitted else 403)]:
                headers = {"Host": f"p-{uuid.uuid4()}.localhost:8082",
                           "Content-Type": "application/json",
                           "Access-Control-Request-Method": "POST"}
                if origin is not None:
                    headers["Origin"] = origin
                data = b'{"grant":"invalid"}' if method == "POST" else None
                request = urllib.request.Request(app.url + path, method=method, headers=headers, data=data)
                try:
                    response = urllib.request.urlopen(request, timeout=10)
                except urllib.error.HTTPError as error:
                    response = error
                with response:
                    assert response.status == status, (method, origin, response.status)
                    headers = response.headers
                    assert headers.get("Access-Control-Allow-Origin") == (origin if admitted else None)
                    if admitted:
                        assert headers["Access-Control-Allow-Credentials"] == "true"
                    assert headers["Vary"] == "Origin, Cookie, Authorization, Sec-Fetch-Dest, Accept-Encoding"
                    ancestors = read_frame_ancestors(headers["Content-Security-Policy"])
                    assert ancestors == [expected], ancestors
                    assert headers.get("Set-Cookie") is None
        check_rollout_admission(app, enabled)
        print(f"PASS desktop catalogue flag={enabled}: CORS echo, refused origins, exact frame ancestors, "
              "health, errors, HEAD, preflight, grant Origin and rollout admission")
    finally:
        app.close()


if __name__ == "__main__":
    for enabled in [False, True]:
        smoke(sys.argv[1], enabled)
