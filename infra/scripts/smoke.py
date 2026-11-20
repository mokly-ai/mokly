"""Real post-rollout HTTP checks; failures retain a redacted JSON report."""

from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import socket
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

import smoke_admission


USER_AGENT = "mkc-smoke"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@dataclass(frozen=True)
class Response:
    status: int
    headers: dict
    body: bytes


class HttpClient:
    def get(self, url, origin=None):
        headers = {"User-Agent": USER_AGENT}
        if origin:
            headers["Origin"] = origin
        return self.request(Request(url, headers=headers))

    def options(self, url, origin):
        return self.request(Request(url, method="OPTIONS", headers={
            "User-Agent": USER_AGENT, "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }))

    def request(self, request):
        try:
            response = build_opener(NoRedirect()).open(request, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            return Response(response.status, {k.lower(): v for k, v in response.headers.items()},
                            response.read(2 * 1024 * 1024))

    def post(self, url, body, headers):
        request_headers = dict(headers)
        request_headers["User-Agent"] = USER_AGENT
        return self.request(Request(url, data=body, headers=request_headers, method="POST"))

    def resolve(self, host):
        socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)


class AppAssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "script" and attributes.get("src"):
            self.assets.append(attributes["src"])
        if tag == "link" and "stylesheet" in attributes.get("rel", "").split():
            if attributes.get("href"):
                self.assets.append(attributes["href"])


def app_asset(body):
    parser = AppAssetParser()
    parser.feed(body.decode("utf-8"))
    require(parser.assets, "App document did not reference a script or stylesheet")
    return next((asset for asset in parser.assets if hashed_asset(asset)), parser.assets[0])


def hashed_asset(asset):
    return bool(re.search(r"[.-][A-Za-z0-9_-]{8,}[.](?:css|js)$", urlsplit(asset).path))


def configuration(environment):
    app, api = (environment[name] for name in ("MKC_APP_ORIGIN", "MKC_API_ORIGIN"))
    domain, revision = (environment[name] for name in ("MKC_CATALOGUE_DOMAIN", "MKC_REVISION"))
    for origin in (app, api):
        parsed = urlsplit(origin)
        if (parsed.scheme != "https" or not parsed.hostname or parsed.path or
                parsed.query or parsed.fragment or parsed.username or parsed.password or
                parsed.port not in (None, 443)):
            raise ValueError("Smoke requires HTTPS origins without paths or credentials")
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]+", domain):
        raise ValueError("Invalid catalogue domain")
    app_host = urlsplit(app).hostname
    api_host = urlsplit(api).hostname
    if app_host == api_host or any(urlsplit(origin).hostname == domain or
                         urlsplit(origin).hostname.endswith("." + domain) for origin in (app, api)):
        raise ValueError("App, API and catalogue must be isolated origins")
    preview_match = re.fullmatch(
        r"(br-main|pr-[1-9][0-9]{0,8})[.]preview[.](.+)", app_host
    )
    if preview_match:
        label, public_domain = preview_match.groups()
        if api_host != f"{label}.preview.api.{public_domain}":
            raise ValueError("Preview app and API origins do not share one environment label")
        preview = True
    else:
        if api_host != "api." + app_host:
            raise ValueError("Production API origin must be api.<app-host>")
        preview = False
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("Expected a full Git revision")
    return app, api, domain, revision, preview, smoke_admission.desktop_enabled(environment)


def require(condition, description):
    if not condition:
        raise ValueError(description)


def checks(client, app, api, domain, revision, preview, desktop_client, results):
    def check(name, action):
        try:
            action()
        except (ValueError, KeyError, TypeError, OSError, URLError) as error:
            results.append({"check": name, "passed": False, "error": str(error)})
            raise
        results.append({"check": name, "passed": True})

    health = client.get(api + "/v1/health")
    check("api-health", lambda: require(health.status == 200 and
          health.headers.get("content-type", "").startswith("application/json") and
          health.headers.get("cache-control") == "no-store", "API health HTTP contract failed"))
    data = json.loads(health.body)
    check("api-version", lambda: require(isinstance(data, dict) and data.get("status") == "ok" and
          isinstance(data.get("version"), str) and bool(data["version"]) and
          data.get("revision") == revision, "API build revision/status mismatch"))
    check("migration-state", lambda: require(data.get("migrations") == "current", "Database migrations are pending"))
    check("api-cors", lambda: smoke_admission.cors(
        client, api + "/v1/health", app, desktop_client, "API", 200))
    page = client.get(app + "/sign-in")

    def app_served():
        require(page.status == 200 and
                page.headers.get("content-type", "").startswith("text/html") and
                b"<html" in page.body.lower() and
                (not preview or page.headers.get("x-robots-tag", "").lower() == "noindex"),
                "App sign-in document was not served through the public origin")
        asset_path = app_asset(page.body)
        asset_url = urlsplit(asset_path)
        require(not asset_url.scheme and not asset_url.netloc and asset_path.startswith("/"),
                "App document asset was not root-relative")
        asset = client.get(app + asset_path)
        require(asset.status == 200, "App document asset was not served")
        if hashed_asset(asset_path):
            require("immutable" in asset.headers.get("cache-control", "").lower(),
                    "Hashed app asset was not immutable")

    check("app-served", app_served)
    if preview:
        preview_root = client.get(app + "/")
        check("preview-root", lambda: require(
            preview_root.status == 200 and
            preview_root.headers.get("content-type", "").startswith("text/html") and
            b"<html" in preview_root.body.lower() and
            preview_root.headers.get("x-robots-tag", "").lower() == "noindex" and
            "location" not in preview_root.headers,
            "Preview root did not serve the noindex app document"))
    else:
        site = client.get(app + "/docs/")
        check("production-site", lambda: require(
            site.status == 200 and
            site.headers.get("content-type", "").startswith("text/html") and
            b"<html" in site.body.lower() and
            "location" not in site.headers,
            "Production site document was not served through Pages"))
    host = "smoke-" + revision[:12] + "." + domain
    check("catalogue-dns", lambda: client.resolve(host))
    catalogue_url = "https://" + host + "/"
    catalogue = client.get(catalogue_url, app)
    check("catalogue-isolation", lambda: require(catalogue.status == 404, "Reserved catalogue host must return 404"))
    check("catalogue-headers", lambda: smoke_admission.catalogue_headers(
        catalogue.headers, app, desktop_client))
    check("catalogue-cors", lambda: smoke_admission.cors(
        client, catalogue_url, app, desktop_client, "Catalogue", 404))
    webhook = api + "/v1/billing/webhooks"
    body = b'{"id":"evt_deployment_smoke"}'

    def require_webhook(response, status, reason, description):
        data = json.loads(response.body)
        error = data.get("error") if isinstance(data, dict) else None
        actual_reason = error.get("reason") if isinstance(error, dict) else None
        final = response.status == status and actual_reason == reason
        unconfigured = response.status == 503 and actual_reason == "operation-unavailable"
        require(final or unconfigured, description)

    unsigned = client.post(webhook, body, {"Content-Type": "application/json"})
    check("billing-webhook-unsigned", lambda: require_webhook(
        unsigned, 400, "validation-failed", "Unsigned billing webhook contract failed"))
    signature = f"t={int(time.time())},v1={'0' * 64}"
    forged = client.post(webhook, body, {
        "Content-Type": "application/json", "Stripe-Signature": signature,
    })
    check("billing-webhook-forged", lambda: require_webhook(
        forged, 401, "webhook-signature-invalid", "Forged billing webhook contract failed"))


def main():
    report = {"time": datetime.now(timezone.utc).isoformat(), "passed": False, "checks": []}
    try:
        settings = configuration(os.environ)
        report["revision"] = settings[3]
        timeout = os.environ.get("MKC_SMOKE_TIMEOUT_SECONDS", "60")
        require(re.fullmatch(r"[1-9][0-9]{0,2}", timeout) and int(timeout) <= 900,
                "MKC_SMOKE_TIMEOUT_SECONDS must be an integer from 1 to 900")
        deadline = time.monotonic() + int(timeout)
        attempt = 0
        while time.monotonic() < deadline:
            attempt += 1
            report.update(attempt=attempt, checks=[])
            try:
                checks(HttpClient(), *settings, report["checks"])
                report["passed"] = True
                report.pop("error", None)
                break
            except (ValueError, KeyError, TypeError, OSError, URLError) as error:
                report["error"] = str(error)
                print(f"Smoke attempt {attempt} failed: {error}", file=sys.stderr)
                remaining = deadline - time.monotonic()
                if remaining > 0:
                    time.sleep(min(5, remaining))
    except (ValueError, KeyError) as error:
        report["error"] = str(error)
    destination = Path(os.environ.get("MKC_SMOKE_REPORT", ".context/deployment-smoke.json"))
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n")
    for result in report["checks"]:
        print(("PASS " if result["passed"] else "FAIL ") + result["check"])
    if not report["passed"]:
        print(report.get("error", "Smoke failed"), file=sys.stderr)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
