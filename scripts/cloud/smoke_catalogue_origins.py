"""Real catalogue server CORS and frame admission in both desktop flag states."""

import json
from pathlib import Path
import sys
import urllib.error
import urllib.request
import uuid

from smoke_support import Api


DESKTOP = json.loads((Path(__file__).resolve().parents[2] / "fixtures/desktop-origin.json").read_text())["origin"]


def smoke(executable, enabled):
    app = Api(executable, overrides={"MKC_DESKTOP_CLIENT": str(enabled).lower(),
                                     "MKC_CATALOGUE_BIND": "127.0.0.1:0"},
              isolated_database=True)
    try:
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
                    assert headers["Vary"] == "Origin, Cookie, Accept-Encoding"
                    csp = headers["Content-Security-Policy"]
                    ancestors = [part.strip().split()[1:] for part in csp.split(";")
                                 if part.strip().startswith("frame-ancestors ")]
                    expected = ["'self'", app.origin] + ([DESKTOP] if enabled else [])
                    assert ancestors == [expected], ancestors
                    assert headers.get("Set-Cookie") is None
        print(f"PASS desktop catalogue flag={enabled}: CORS echo, refused origins, exact frame ancestors, health, errors, HEAD, preflight and grant Origin")
    finally:
        app.close()


if __name__ == "__main__":
    for enabled in [False, True]:
        smoke(sys.argv[1], enabled)
