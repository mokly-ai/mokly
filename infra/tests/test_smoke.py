"""HTTP integration fixtures exercise the real client and each rollout failure."""

import json
import unittest

from smoke_http_support import API, APP, CSP, DESKTOP, DOMAIN, REVISION, SmokeTransport, smoke


class SmokeTests(SmokeTransport):
    def test_complete_response_contract(self):
        results = self.check()
        self.assertEqual(len(results), 12)
        self.assertTrue(all(item["passed"] for item in results))

    def test_enabled_desktop_catalogue_policy_is_accepted(self):
        self.check()

    def test_disabled_desktop_policy_is_accepted_and_never_gets_a_cors_grant(self):
        self.allowed_origins.remove(DESKTOP)
        self.responses["/"][1]["Content-Security-Policy"] = CSP
        self.check(enabled=False)

    def test_mismatched_desktop_flag_reports_the_expected_frame_ancestors(self):
        for enabled, csp in ((True, CSP), (False, CSP + " " + DESKTOP)):
            with self.subTest(enabled=enabled):
                self.allowed_origins = {APP, DESKTOP} if enabled else {APP}
                self.responses["/"][1]["Content-Security-Policy"] = csp
                with self.assertRaisesRegex(ValueError, "frame-ancestors mismatch.*MKC_DESKTOP_CLIENT"):
                    self.check(enabled=enabled)

    def test_both_services_reject_missing_or_unexpected_cors_grants(self):
        for path in ("/v1/health", "/"):
            original = self.responses[path][1].copy()
            for key in ("Access-Control-Allow-Origin", "Access-Control-Allow-Credentials", "Vary"):
                with self.subTest(path=path, key=key):
                    self.responses[path][1] = dict(original)
                    self.responses[path][1].pop(key)
                    with self.assertRaisesRegex(ValueError, "CORS mismatch"):
                        self.check()
            self.responses[path][1] = original
        self.allowed_origins.add(smoke.smoke_admission.THIRD_ORIGIN)
        with self.assertRaisesRegex(ValueError, "CORS mismatch.*smoke-untrusted"):
            self.check()

    def test_preflights_require_the_credentialed_post_and_content_type_grant(self):
        for key in self.preflight_headers:
            original = self.preflight_headers[key]
            self.preflight_headers[key] = "wrong"
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "CORS mismatch.*OPTIONS"):
                self.check()
            self.preflight_headers[key] = original

    def test_unsigned_billing_webhook_contract_is_accepted(self):
        results = self.check()
        self.assertTrue(next(item for item in results
                             if item["check"] == "billing-webhook-unsigned")["passed"])

    def test_forged_billing_webhook_contract_is_accepted(self):
        results = self.check()
        self.assertTrue(next(item for item in results
                             if item["check"] == "billing-webhook-forged")["passed"])

    def test_unconfigured_billing_route_is_accepted(self):
        unconfigured = [503, {"Content-Type": "application/json"},
                        json.dumps({"error": {"reason": "operation-unavailable"}}).encode()]
        self.billing_responses["unsigned"] = unconfigured
        self.billing_responses["forged"] = unconfigured
        results = self.check()
        self.assertTrue(all(next(item for item in results if item["check"] == name)["passed"]
                            for name in ("billing-webhook-unsigned", "billing-webhook-forged")))

    def test_successful_billing_webhook_response_is_rejected(self):
        self.billing_responses["unsigned"] = [
            200, {"Content-Type": "application/json"},
            json.dumps({"error": {"reason": "validation-failed"}}).encode(),
        ]
        with self.assertRaisesRegex(ValueError, "Unsigned billing webhook contract failed"):
            self.check()

    def test_wrong_billing_webhook_reason_is_rejected(self):
        self.billing_responses["forged"] = [
            401, {"Content-Type": "application/json"},
            json.dumps({"error": {"reason": "validation-failed"}}).encode(),
        ]
        with self.assertRaisesRegex(ValueError, "Forged billing webhook contract failed"):
            self.check()

    def test_every_request_identifies_the_smoke_client(self):
        self.check()
        self.assertTrue(self.requests)
        for path, headers in self.requests:
            self.assertEqual(headers.get("user-agent"), smoke.USER_AGENT, path)
        self.assertEqual(smoke.USER_AGENT, "mkc-smoke")

    def test_production_checks_the_site_instead_of_preview_root(self):
        results = []
        smoke.checks(self.client, APP, API, DOMAIN, REVISION, False, True, results)
        self.assertEqual(len(results), 12)
        self.assertEqual(results[5], {"check": "production-site", "passed": True})
        self.responses["/docs/"][0] = 404
        with self.assertRaisesRegex(ValueError, "Production site"):
            smoke.checks(self.client, APP, API, DOMAIN, REVISION, False, True, [])

    def test_bad_status_redirect_and_non_json_fail(self):
        for status in (301, 401, 500, 503):
            with self.subTest(status=status):
                self.responses["/v1/health"][0] = status
                self.responses["/v1/health"][1]["Location"] = "/sign-in"
                with self.assertRaisesRegex(ValueError, "API health"):
                    self.check()
        self.responses["/v1/health"][0] = 200
        self.responses["/v1/health"][2] = b"not JSON"
        with self.assertRaises(ValueError):
            self.check()

    def test_wrong_release_and_pending_migrations_fail(self):
        original = self.responses["/v1/health"][2]
        for key, value in (("revision", "b" * 40), ("version", ""), ("migrations", "pending")):
            with self.subTest(key=key):
                data = json.loads(original)
                data[key] = value
                self.responses["/v1/health"][2] = json.dumps(data).encode()
                with self.assertRaises(ValueError):
                    self.check()

    def test_app_and_catalogue_failures(self):
        self.responses["/sign-in"][2] = b"API fallback"
        with self.assertRaisesRegex(ValueError, "sign-in document"):
            self.check()
        self.responses["/sign-in"][2] = b'<html><script src="/_expo/static/js/web/entry-abcdef1234567890.js"></script></html>'
        self.responses["/"][0] = 200
        with self.assertRaisesRegex(ValueError, "return 404"):
            self.check()

    def test_app_document_requires_a_bootable_root_asset(self):
        document = self.responses["/sign-in"]
        asset = self.responses["/_expo/static/js/web/entry-abcdef1234567890.js"]
        for body, status, cache, error in [
            (b"<html></html>", 200, "public, immutable", "script or stylesheet"),
            (b'<html><script src="entry-abcdef1234567890.js"></script></html>',
             200, "public, immutable", "root-relative"),
            (document[2], 404, "public, immutable", "asset was not served"),
            (document[2], 200, "public, max-age=31536000", "not immutable"),
        ]:
            with self.subTest(error=error):
                document[2] = body
                asset[0] = status
                asset[1]["Cache-Control"] = cache
                with self.assertRaisesRegex(ValueError, error):
                    self.check()

    def test_preview_root_requires_the_worker_response_contract(self):
        fixture = "/preview-root-app"
        original = self.responses[fixture]
        for index, value in [
            (0, 302),
            (1, {"Content-Type": "text/plain", "Cache-Control": "no-store",
                 "X-Robots-Tag": "noindex"}),
            (1, {"Content-Type": "text/html", "Cache-Control": "no-store"}),
            (1, {"Content-Type": "text/html", "Cache-Control": "no-store",
                 "X-Robots-Tag": "noindex", "Location": "/dashboard"}),
        ]:
            with self.subTest(index=index, value=value):
                self.responses[fixture] = [*original]
                self.responses[fixture][index] = value
                with self.assertRaisesRegex(ValueError, "Preview root"):
                    self.check()
        self.responses[fixture] = original

    def test_every_security_header_is_required(self):
        original = self.responses["/"][1].copy()
        mutations = [(key, "wrong") for key in original if key != "Content-Type"]
        mutations += [("Set-Cookie", "session=bad"),
                      ("Content-Security-Policy", "frame-ancestors " + APP),
                      ("Content-Security-Policy", "frame-ancestors 'self'"),
                      ("Content-Security-Policy", "frame-ancestors 'self' " + APP + " https://evil.invalid"),
                      ("Content-Security-Policy", "frame-ancestors 'self' 'self' " + APP),
                      ("Content-Security-Policy", "frame-ancestors 'self' " + APP + " " + APP),
                      ("Content-Security-Policy", "frame-ancestors 'self' " + APP + "; frame-ancestors 'self' " + APP)]
        for key, value in mutations:
            with self.subTest(key=key, value=value):
                self.responses["/"][1] = dict(original, **{key: value})
                with self.assertRaisesRegex(ValueError, "headers failed|frame-ancestors mismatch|CORS mismatch"):
                    self.check()


class OriginTests(unittest.TestCase):
    def test_smoke_requires_an_explicit_exact_desktop_flag(self):
        values = dict(MKC_APP_ORIGIN=APP, MKC_API_ORIGIN=API,
                      MKC_CATALOGUE_DOMAIN=DOMAIN, MKC_REVISION=REVISION)
        for value in (None, "", "TRUE", "1", "false "):
            environment = dict(values)
            if value is not None:
                environment["MKC_DESKTOP_CLIENT"] = value
            with self.subTest(value=value):
                with self.assertRaisesRegex(ValueError, "MKC_DESKTOP_CLIENT.*true or false"):
                    smoke.configuration(environment)
        for value in ("true", "false"):
            self.assertEqual(smoke.configuration(dict(values, MKC_DESKTOP_CLIENT=value))[-1],
                             value == "true")

    def test_documented_manual_invocation_uses_the_root_app_layout(self):
        values = dict(MKC_APP_ORIGIN=APP, MKC_API_ORIGIN=API,
                      MKC_CATALOGUE_DOMAIN=DOMAIN, MKC_REVISION=REVISION, MKC_DESKTOP_CLIENT="true")
        self.assertEqual(smoke.configuration(values), (APP, API, DOMAIN, REVISION, True, True))

    def test_origin_validation(self):
        values = dict(MKC_APP_ORIGIN=APP, MKC_API_ORIGIN=API,
                      MKC_CATALOGUE_DOMAIN=DOMAIN, MKC_REVISION=REVISION, MKC_DESKTOP_CLIENT="true")
        self.assertEqual(smoke.configuration(values), (APP, API, DOMAIN, REVISION, True, True))
        for value in ("http://example.invalid", APP + "/", APP + "?q=x",
                      "https://user:secret@app.example.invalid", "https://" + DOMAIN):
            with self.subTest(value=value), self.assertRaises(ValueError):
                smoke.configuration(dict(values, MKC_APP_ORIGIN=value))

    def test_default_port_does_not_hide_same_origin(self):
        with self.assertRaises(ValueError):
            smoke.configuration(dict(MKC_APP_ORIGIN=APP, MKC_API_ORIGIN=APP + ":443",
                                     MKC_CATALOGUE_DOMAIN=DOMAIN, MKC_REVISION=REVISION, MKC_DESKTOP_CLIENT="true"))

    def test_production_layout_skips_only_the_preview_root_check(self):
        app = "https://example.invalid"
        api = "https://api.example.invalid"
        values = dict(MKC_APP_ORIGIN=app, MKC_API_ORIGIN=api,
                      MKC_CATALOGUE_DOMAIN=DOMAIN, MKC_REVISION=REVISION, MKC_DESKTOP_CLIENT="true")
        self.assertEqual(smoke.configuration(values), (app, api, DOMAIN, REVISION, False, True))

    def test_mismatched_public_host_layout_is_rejected(self):
        values = dict(MKC_APP_ORIGIN=APP, MKC_API_ORIGIN="https://api.example.invalid",
                      MKC_CATALOGUE_DOMAIN=DOMAIN, MKC_REVISION=REVISION, MKC_DESKTOP_CLIENT="true")
        with self.assertRaisesRegex(ValueError, "environment label"):
            smoke.configuration(values)
