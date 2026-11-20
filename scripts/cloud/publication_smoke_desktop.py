"""Desktop private grants, HTML and read-model headers on a real publication."""

import json
from pathlib import Path

from publication_smoke_support import Catalogue


DESKTOP = json.loads((Path(__file__).resolve().parents[2] / "fixtures/desktop-origin.json").read_text())["origin"]


def desktop_admission(api, catalogue, owner, project, publication, executable):
    disabled = Catalogue(executable, api, desktop_client=False)
    try:
        for enabled, host in [(True, catalogue), (False, disabled)]:
            for origin in [api.origin, DESKTOP]:
                grant, _ = api.call("POST", f'/v1/projects/{project["id"]}/publications/{publication["id"]}/access-grants', {},
                                    session=owner, expected=201, extra={"Origin": origin})
                admitted = enabled or origin == api.origin
                _, headers = host.fetch(publication, "/_access", "POST", {"grant": grant["grant"]},
                                        origin=origin, expected=204 if admitted else 403)
                assert headers.get("access-control-allow-origin") == (origin if admitted else None)
                if not admitted:
                    assert "set-cookie" not in headers
                    continue
                cookie = headers["set-cookie"].split(";")[0]
                for path in ["/", "/mokly-viewer/index.json"]:
                    body, headers = host.fetch(publication, path, cookie=cookie, origin=origin)
                    assert body
                    assert headers["access-control-allow-origin"] == origin
                    assert headers["access-control-allow-credentials"] == "true"
                _, headers = host.fetch(publication, cookie=cookie, origin="https://third.example.com")
                assert "access-control-allow-origin" not in headers
                _, headers = host.fetch(publication, "/_access", "POST", {"grant": "invalid"},
                                        origin="https://third.example.com", expected=403)
                assert "set-cookie" not in headers
        print("PASS desktop publication: API grants, catalogue exchange, private HTML/read model, exact CORS and frame ancestors with flag on/off")
    finally:
        disabled.close()
