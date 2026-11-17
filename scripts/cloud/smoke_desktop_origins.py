"""Real API origin admission, email links and session-cookie lifecycle."""

import json
from pathlib import Path
import secrets
import sys
import uuid

from smoke_support import Api


DESKTOP = json.loads((Path(__file__).resolve().parents[2] / "fixtures/desktop-origin.json").read_text())["origin"]
THIRD = "https://third.example.com"


def cors(headers, origin, admitted):
    assert headers.get("Access-Control-Allow-Origin") == (origin if admitted else None), headers
    if admitted:
        assert headers["Access-Control-Allow-Credentials"] == "true"
    vary = ",".join(headers.get_all("Vary", []))
    assert "origin" in [part.strip().lower() for part in vary.split(",")], vary


def cookie(headers, origin, clearing=False):
    value = headers["Set-Cookie"]
    same_site = "None" if origin == DESKTOP else "Lax"
    attributes = value.split("; ")
    assert attributes[1:4] == ["Path=/", "Secure", "HttpOnly"], value
    assert attributes[4] == "SameSite=" + same_site, value
    assert len(attributes) == 6 and attributes[5].startswith("Max-Age="), value
    if clearing:
        assert attributes[0] == "mkc_session=" and attributes[5] == "Max-Age=0", value
    else:
        assert len(attributes[0].removeprefix("mkc_session=")) == 64, value
        assert int(attributes[5].removeprefix("Max-Age=")) > 0, value
    return attributes[0]


def session(result, headers, origin):
    return {"cookie": cookie(headers, origin), "csrf": result["csrfToken"]}


def lifecycle(api, origin, preview_secret):
    email = str(uuid.uuid4()) + "@example.com"
    _, headers = api.call("POST", "/v1/auth/magic-links", {"email": email},
                          expected=202, extra={"Origin": origin})
    cors(headers, origin, True)
    link = api.event("recipient", email)["link"]
    landing = "/auth/email/callback" + ("?client=desktop" if origin == DESKTOP else "")
    assert link.startswith(api.origin + landing + "#token="), link
    token = link.split("#token=")[1]
    result, headers = api.call("POST", "/v1/auth/callback", {"token": token},
                              extra={"Origin": origin})
    cors(headers, origin, True)
    active = session(result["session"], headers, origin)
    for refused in [THIRD, "null", None]:
        error, headers = api.call("POST", "/v1/session", session=active, expected=403,
                                  extra={"Origin": refused})
        assert error["error"]["reason"] == "csrf-rejected"
        cors(headers, refused, False)
        assert headers.get("Set-Cookie") is None
    api.call("POST", "/v1/session", session=active, expected=403,
             extra={"Origin": origin, "X-CSRF-Token": "wrong"})
    # Rotate across both origins to prove selection uses this request, not issuance.
    rotations = [api.origin, origin] if api.environment["MKC_DESKTOP_CLIENT"] == "false" else [DESKTOP, api.origin, origin]
    for rotate_origin in rotations:
        result, headers = api.call("POST", "/v1/session", session=active,
                                  extra={"Origin": rotate_origin})
        cors(headers, rotate_origin, True)
        prior = active
        active = session(result, headers, rotate_origin)
        api.call("GET", "/v1/session", session=prior, expected=401)
        api.call("GET", "/v1/session", session=active, extra={"Origin": rotate_origin})
    _, headers = api.call("DELETE", "/v1/session", session=active, expected=204,
                          extra={"Origin": origin})
    cookie(headers, origin, clearing=True)
    api.call("GET", "/v1/session", session=active, expected=401)
    result, headers = api.call("POST", "/v1/auth/preview", {"secret": preview_secret},
                              extra={"Origin": origin})
    active = session(result["session"], headers, origin)
    _, headers = api.call("DELETE", "/v1/session", session=active, expected=204,
                          extra={"Origin": origin})
    cookie(headers, origin, clearing=True)


def smoke(executable, enabled):
    secret = secrets.token_hex(32)
    api = Api(executable, overrides={"MKC_DESKTOP_CLIENT": str(enabled).lower(),
                                     "MKC_PREVIEW_SIGN_IN_SECRET": secret,
                                     "MKC_PREVIEW_SIGN_IN_EMAIL": "desktop-preview@example.com"})
    try:
        for origin in [api.origin, DESKTOP, THIRD, "null", None]:
            admitted = origin == api.origin or enabled and origin == DESKTOP
            for method, path, expected in [("OPTIONS", "/v1/session", 200),
                                           ("GET", "/v1/health", 200),
                                           ("GET", "/v1/session", 401)]:
                _, headers = api.call(method, path, expected=expected,
                                      extra={"Origin": origin,
                                             "Access-Control-Request-Method": "POST",
                                             "Access-Control-Request-Headers": "content-type,x-csrf-token"})
                cors(headers, origin, admitted)
            if not admitted:
                for path, body in [("/v1/auth/magic-links", {"email": "refused@example.com"}),
                                   ("/v1/auth/callback", {"token": "a" * 64}),
                                   ("/v1/auth/preview", {"secret": secret})]:
                    error, headers = api.call("POST", path, body, expected=403, extra={"Origin": origin})
                    assert error["error"]["reason"] == "csrf-rejected"
                    assert headers.get("Set-Cookie") is None
            else:
                lifecycle(api, origin, secret)
        print(f"PASS desktop API flag={enabled}: exact CORS, refused origins, email link, magic/preview cookies, cross-origin rotation and sign-out")
    finally:
        api.close()


if __name__ == "__main__":
    for enabled in [False, True]:
        smoke(sys.argv[1], enabled)
