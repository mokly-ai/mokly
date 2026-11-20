"""Exact deployment CORS and framing checks for the resolved desktop flag."""

import json
from pathlib import Path


DESKTOP_ORIGIN = json.loads(
    (Path(__file__).resolve().parents[2] / "fixtures/desktop-origin.json").read_text()
)["origin"]
THIRD_ORIGIN = "https://smoke-untrusted.invalid"


def desktop_enabled(environment):
    value = environment.get("MKC_DESKTOP_CLIENT")
    if value not in ("true", "false"):
        raise ValueError("MKC_DESKTOP_CLIENT must be explicitly true or false for smoke")
    return value == "true"


def frame_ancestors(app, enabled):
    return ["'self'", app] + ([DESKTOP_ORIGIN] if enabled else [])


def catalogue_headers(headers, app, enabled):
    directives = [part.strip().split() for part in headers.get("content-security-policy", "").split(";")]
    ancestors = [part[1:] for part in directives if part and part[0] == "frame-ancestors"]
    expected = [frame_ancestors(app, enabled)]
    if ancestors != expected:
        raise ValueError(f"Catalogue frame-ancestors mismatch for MKC_DESKTOP_CLIENT={str(enabled).lower()}: "
                         f"expected {expected}, received {ancestors}")
    if (headers.get("x-content-type-options") != "nosniff" or
            headers.get("cache-control") != "no-store" or "set-cookie" in headers):
        raise ValueError("Catalogue sandbox/cache headers failed")


def cors(client, url, app, enabled, service, status):
    """Check credentialed reads and preflights, including an untrusted origin."""
    for origin in (app, DESKTOP_ORIGIN, THIRD_ORIGIN):
        admitted = origin == app or enabled and origin == DESKTOP_ORIGIN
        for method, request in (("GET", client.get), ("OPTIONS", client.options)):
            response = request(url, origin)
            headers = response.headers
            vary = {token.strip().lower() for token in headers.get("vary", "").split(",")}
            valid = (response.status == (status if method == "GET" else 200) and
                     headers.get("access-control-allow-origin") == (origin if admitted else None) and
                     "origin" in vary)
            if admitted:
                valid = valid and headers.get("access-control-allow-credentials") == "true"
                if method == "OPTIONS":
                    methods = {token.strip() for token in headers.get("access-control-allow-methods", "").split(",")}
                    allowed = {token.strip().lower() for token in headers.get("access-control-allow-headers", "").split(",")}
                    valid = valid and "POST" in methods and "content-type" in allowed
            if not valid:
                raise ValueError(f"{service} CORS mismatch for {method} Origin {origin} "
                                 f"with MKC_DESKTOP_CLIENT={str(enabled).lower()}")
