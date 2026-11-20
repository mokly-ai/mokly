"""Exact-address preview sign-in log selection through kubectl."""

from contextlib import redirect_stderr, redirect_stdout
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from support import ROOT, load

link = load("preview-link")
sources = load("preview_link_sources")
FIXTURES = ROOT / "infra/tests/fixtures/preview-lifecycle"


class LinkParsingTests(unittest.TestCase):
    def test_pod_names_accept_kubectl_list_and_api_pod_list_only(self):
        items = [{"metadata": {"name": "api-one"}}]
        for kind in ("PodList", "List"):
            self.assertEqual(sources.pod_names({"kind": kind, "items": items}), ["api-one"])
        for bad in ({"kind": "ServiceList", "items": items}, {"items": items}, {"kind": "List", "items": None}):
            with self.assertRaisesRegex(sources.SourceError, "malformed"):
                sources.pod_names(bad)

    def test_email_normalization_matches_the_rust_api_rule(self):
        self.assertEqual(link.normalize_email("  Reviewer@EXAMPLE.COM \n"), "reviewer@example.com")
        for value in ("missing-at.example.com", "a@example", "a@@example.com", "a @example.com", "a,<b>@example.com"):
            with self.subTest(value=value), self.assertRaises(link.LinkError):
                link.normalize_email(value)

    def test_real_api_log_line_selects_newest_exact_address_and_fragment(self):
        logs = [
            (FIXTURES / "api-log-previous.txt").read_text(),
            (FIXTURES / "api-log-current.txt").read_text(),
        ]
        result = link.newest_link(logs, "reviewer@example.com", "pr-42.preview.example.com")
        self.assertEqual(
            result,
            "https://pr-42.preview.example.com/auth/email/callback#token=" + "a" * 64,
        )
        self.assertNotIn("someone-else", result)

    def test_equal_timestamps_use_later_source_order(self):
        original = (FIXTURES / "api-log-current.txt").read_text().strip()
        second = original.replace("a" * 64, "d" * 64)
        result = link.newest_link(
            [original + "\n", second + "\n"],
            "reviewer@example.com",
            "pr-42.preview.example.com",
        )
        self.assertTrue(result.endswith("d" * 64))

    def test_wrong_origin_scheme_and_malformed_matching_event_fail(self):
        base = "https://pr-42.preview.example.com/auth/email/callback#token=abc"
        for value in (
            base.replace("https://", "http://"),
            base.replace("pr-42", "pr-43"),
            base.replace("pr-42.preview.example.com", "pr-42.preview.example.com:8443"),
            base.replace("https://", "https://user@"),
            base.removesuffix("#token=abc"),
            base + "\x00",
        ):
            with self.subTest(value=value), self.assertRaises(link.LinkError):
                link.sign_in_link(value, "pr-42.preview.example.com")
        self.assertEqual(link.sign_in_link(base, "pr-42.preview.example.com"), base)
        with self.assertRaisesRegex(link.LinkError, "malformed"):
            link.newest_link(
                [(FIXTURES / "api-log-malformed.txt").read_text()],
                "reviewer@example.com",
                "pr-42.preview.example.com",
            )


    def test_another_product_email_to_the_address_is_skipped_not_failed(self):
        lines = (FIXTURES / "api-log-invitation.txt").read_text().splitlines()
        invitation, sign_in = lines
        expected = "https://pr-42.preview.example.com/auth/email/callback#token=" + "b" * 64
        for order in ((invitation, sign_in), (sign_in, invitation)):
            with self.subTest(order=[line[:30] for line in order]):
                result = link.newest_link(["\n".join(order) + "\n"], "invited-colleague@example.com", "pr-42.preview.example.com")
                self.assertEqual(result, expected)
        self.assertIsNone(link.newest_link([invitation + "\n"], "invited-colleague@example.com", "pr-42.preview.example.com"))
        self.assertIsNone(link.sign_in_link(
            "https://pr-42.preview.example.com/workspaces/00000000-0000-0000-0000-000000000001/invitations/00000000-0000-0000-0000-000000000002/accept",
            "pr-42.preview.example.com",
        ))
        self.assertIsNone(link.sign_in_link("https://pr-43.preview.example.com/sign-in?returnTo=%2Fdashboard", "pr-42.preview.example.com"))


class KubectlTests(unittest.TestCase):
    def fake_kubectl(self, directory):
        path = Path(directory) / "kubectl"
        path.write_text("""#!/usr/bin/env bash
set -euo pipefail
printf 'kubectl %s\\n' "$*" >> "$CALLS"
if [[ "$*" == *" get pods "* ]]; then cat "$FIXTURES/kubectl-pods.json"; exit 0; fi
if [[ "$*" == *"api-6c9fd6f8d7-first"* && "$*" == *"--previous"* ]]; then
  cat "$FIXTURES/kubectl-previous-absent.stderr.txt" >&2; exit 1
fi
if [[ "$*" == *"api-6c9fd6f8d7-second"* && "$*" == *"--previous"* ]]; then
  cat "$FIXTURES/api-log-previous.txt"; exit 0
fi
if [[ "$*" == *"api-6c9fd6f8d7-first"* ]]; then cat "$FIXTURES/api-log-current.txt"; exit 0; fi
if [[ "$*" == *"api-6c9fd6f8d7-second"* ]]; then exit 0; fi
exit 90
""")
        path.chmod(0o755)

    def test_cli_reads_current_and_available_previous_logs(self):
        with tempfile.TemporaryDirectory() as directory:
            self.fake_kubectl(directory)
            calls = Path(directory) / "calls"
            environment = dict(
                os.environ,
                PATH=directory + ":" + os.environ["PATH"],
                CALLS=str(calls),
                FIXTURES=str(FIXTURES),
                MKC_DOMAIN="example.com",
            )
            result = subprocess.run(
                [
                    "python3", "infra/scripts/preview-link.py", "preview-pr-42",
                    "--email", " Reviewer@EXAMPLE.COM ",
                    "--since-time", "2026-09-22T21:30:00Z", "--timeout-seconds", "1",
                ],
                cwd=ROOT,
                env=environment,
                capture_output=True,
                text=True,
                timeout=10,
            )
            recorded = calls.read_text()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            result.stdout,
            "https://pr-42.preview.example.com/auth/email/callback#token=" + "a" * 64 + "\n",
        )
        self.assertEqual(result.stderr, "")
        self.assertIn("--selector app.kubernetes.io/name=api", recorded)
        self.assertEqual(recorded.count("--timestamps --since-time=2026-09-22T21:30:00Z -c api"), 4)

    def test_no_match_exits_one_with_only_the_recovery_diagnostic(self):
        class EmptySource:
            def read(self, _since_time):
                return []

        stdout, stderr = io.StringIO(), io.StringIO()
        with (
            patch.object(link, "KubectlSource", return_value=EmptySource()),
            patch.object(link.time, "monotonic", side_effect=(0, 1)),
            patch.object(link.time, "sleep"),
            redirect_stdout(stdout),
            redirect_stderr(stderr),
        ):
            status = link.main(
                ["preview-pr-42", "--email", "reviewer@example.com", "--timeout-seconds", "1"],
                {"MKC_DOMAIN": "example.com"},
            )
        self.assertEqual(status, 1)
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(stderr.getvalue(), link.NO_LINK + "\n")

    def test_previous_log_forbidden_is_not_treated_as_absent(self):
        result = subprocess.CompletedProcess(
            ["kubectl"], 1, "", "Error from server (Forbidden): pods/log is forbidden\n"
        )
        with patch.object(sources.subprocess, "run", return_value=result):
            with self.assertRaisesRegex(sources.SourceError, "Forbidden"):
                sources.KubectlSource("mkc-preview-pr-42").command(
                    ["kubectl", "logs", "api-one", "--previous"], previous=True
                )


if __name__ == "__main__":
    unittest.main()
