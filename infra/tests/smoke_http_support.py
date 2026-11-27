"""HTTP integration fixtures exercise the real client and each rollout failure."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
import unittest

from support import load

smoke = load("smoke")
# How often a double checks for shutdown; the 0.5 s default slows each test.
SHUTDOWN_POLL_SECONDS = 0.05
REVISION = "a" * 40
APP = "https://br-main.preview.example.invalid"
API = "https://br-main.preview.api.example.invalid"
DOMAIN = "catalogue.example.invalid"
DESKTOP = smoke.smoke_admission.DESKTOP_ORIGIN
CSP = ("default-src 'none'; script-src 'self' 'unsafe-inline'; "
       "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; "
       "connect-src 'self'; media-src 'self'; frame-src 'self'; object-src 'none'; "
       "base-uri 'none'; form-action 'none'; frame-ancestors 'self' " + APP)


class SmokeTransport(unittest.TestCase):
    def setUp(self):
        self.allowed_origins = {APP, DESKTOP}
        self.preflight_headers = {"Access-Control-Allow-Methods": "GET,HEAD,POST",
                                  "Access-Control-Allow-Headers": "content-type"}
        self.responses = {
            "/v1/health": [200, {"Content-Type": "application/json", "Cache-Control": "no-store",
                "Access-Control-Allow-Origin": APP, "Access-Control-Allow-Credentials": "true",
                "Vary": "Origin"},
                json.dumps({"status": "ok", "version": "0.1.0", "revision": REVISION, "migrations": "current"}).encode()],
            "/sign-in": [200, {"Content-Type": "text/html", "X-Robots-Tag": "noindex"},
                b'<!doctype html><html><script src="/_expo/static/js/web/entry-abcdef1234567890.js"></script></html>'],
            "/_expo/static/js/web/entry-abcdef1234567890.js": [200, {
                "Content-Type": "text/javascript", "Cache-Control": "public, max-age=31536000, immutable"},
                b"console.log('app')"],
            "/preview-root-app": [200, {"Content-Type": "text/html", "Cache-Control": "no-cache",
                "X-Robots-Tag": "noindex"},
                b'<!doctype html><html><script src="/_expo/static/js/web/entry-abcdef1234567890.js"></script></html>'],
            "/docs/": [200, {"Content-Type": "text/html"},
                b"<!doctype html><html>site documentation</html>"],
            "/": [404, {"Content-Type": "text/plain", "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff", "Access-Control-Allow-Origin": APP,
                "Access-Control-Allow-Credentials": "true", "Vary": "Origin, Cookie, Authorization, Sec-Fetch-Dest, Accept-Encoding",
                "Content-Security-Policy": CSP + " " + DESKTOP}, b"Not found"],
        }
        self.billing_responses = {
            "unsigned": [400, {"Content-Type": "application/json"},
                         json.dumps({"error": {"reason": "validation-failed"}}).encode()],
            "forged": [401, {"Content-Type": "application/json"},
                       json.dumps({"error": {"reason": "webhook-signature-invalid"}}).encode()],
        }
        self.requests = []
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.respond(False)

            def do_OPTIONS(self):
                self.respond(True)

            def respond(self, preflight):
                owner.requests.append((self.path, {k.lower(): v for k, v in self.headers.items()}))
                status, headers, body = owner.responses[self.path]
                headers = dict(headers)
                origin = self.headers.get("Origin")
                if origin != APP:
                    headers.pop("Access-Control-Allow-Origin", None)
                    if origin in owner.allowed_origins:
                        headers["Access-Control-Allow-Origin"] = origin
                if preflight:
                    headers.update(owner.preflight_headers)
                self.send_response(200 if preflight else status)
                for key, value in headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(body)

            def do_POST(self):
                owner.requests.append((self.path, {k.lower(): v for k, v in self.headers.items()}))
                length = int(self.headers.get("Content-Length", "0"))
                self.rfile.read(length)
                if self.path != "/v1/billing/webhooks":
                    self.send_error(404)
                    return
                key = "forged" if self.headers.get("Stripe-Signature") else "unsigned"
                status, headers, body = owner.billing_responses[key]
                self.send_response(status)
                for name, value in headers.items():
                    self.send_header(name, value)
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(
            target=self.server.serve_forever,
            kwargs={"poll_interval": SHUTDOWN_POLL_SECONDS},
            daemon=True,
        )
        self.thread.start()
        port = self.server.server_address[1]

        class LocalTransport(smoke.HttpClient):
            def get(self, url, origin=None):
                parsed = smoke.urlsplit(url)
                path = ("/preview-root-app" if parsed.hostname == smoke.urlsplit(APP).hostname
                        and parsed.path == "/" else parsed.path)
                return super().get(f"http://127.0.0.1:{port}" + path, origin)

            def options(self, url, origin):
                path = smoke.urlsplit(url).path
                return super().options(f"http://127.0.0.1:{port}" + path, origin)

            def resolve(self, _):
                return super().resolve("localhost")

            def post(self, url, body, headers):
                path = smoke.urlsplit(url).path
                return super().post(f"http://127.0.0.1:{port}" + path, body, headers)

        self.client = LocalTransport()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def check(self, enabled=True):
        results = []
        smoke.checks(self.client, APP, API, DOMAIN, REVISION, True, enabled, results)
        return results
