"""Bounded retry timing for a new load balancer and later releases."""

from contextlib import redirect_stderr, redirect_stdout
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from support import load

smoke = load("smoke")


class SmokeTimingTests(unittest.TestCase):
    def run_smoke(self, budget=None, ready_at=None, preview=False):
        clock = [0]

        def sleep(seconds):
            clock[0] += seconds

        def checks(_client, *_args):
            if ready_at is None or clock[0] < ready_at:
                raise ValueError("Ingress is still provisioning")

        with tempfile.TemporaryDirectory() as temporary:
            report = Path(temporary) / "smoke.json"
            environment = {
                "MKC_APP_ORIGIN": ("https://br-main.preview.example.invalid" if preview
                                   else "https://example.invalid"),
                "MKC_API_ORIGIN": ("https://br-main.preview.api.example.invalid" if preview
                                   else "https://api.example.invalid"),
                "MKC_CATALOGUE_DOMAIN": "catalogues.invalid",
                "MKC_REVISION": "a" * 40, "MKC_SMOKE_REPORT": str(report),
                "MKC_DESKTOP_CLIENT": "true",
            }
            if budget is not None:
                environment["MKC_SMOKE_TIMEOUT_SECONDS"] = budget
            with patch.dict(os.environ, environment, clear=True), \
                    patch.object(smoke.time, "monotonic", side_effect=lambda: clock[0]), \
                    patch.object(smoke.time, "sleep", side_effect=sleep), \
                    patch.object(smoke, "checks", side_effect=checks) as probe, \
                    redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
                result = smoke.main()
            return result, json.loads(report.read_text()), clock[0], probe.call_count

    def test_success_and_failure_reports_keep_the_revision_for_each_origin_layout(self):
        for preview in (False, True):
            for ready_at in (0, None):
                with self.subTest(preview=preview, ready_at=ready_at):
                    _, report, _, _ = self.run_smoke(ready_at=ready_at, preview=preview)
                    self.assertEqual(report["revision"], "a" * 40)

    def test_new_ingress_can_become_ready_after_the_normal_retry_window(self):
        result, report, elapsed, _ = self.run_smoke("900", ready_at=70)
        self.assertEqual(result, 0)
        self.assertTrue(report["passed"])
        self.assertEqual(elapsed, 70)
        self.assertNotIn("error", report)

    def test_normal_release_keeps_a_short_bounded_failure(self):
        result, report, elapsed, _ = self.run_smoke(ready_at=70)
        self.assertEqual(result, 1)
        self.assertFalse(report["passed"])
        self.assertLessEqual(elapsed, 60)
        self.assertEqual(report["error"], "Ingress is still provisioning")

    def test_first_install_failure_is_bounded(self):
        result, report, elapsed, calls = self.run_smoke("900")
        self.assertEqual(result, 1)
        self.assertFalse(report["passed"])
        self.assertEqual(elapsed, 900)
        self.assertEqual(calls, 180)

    def test_invalid_budgets_fail_before_network_requests(self):
        for budget in ("0", "-1", "901", "unlimited"):
            with self.subTest(budget=budget):
                result, report, _, calls = self.run_smoke(budget)
                self.assertEqual(result, 1)
                self.assertEqual(calls, 0)
                self.assertIn("MKC_SMOKE_TIMEOUT_SECONDS", report["error"])
