"""Optional capture timing uses the published CLI flag without changing bytes."""

import contextlib
import io
import json
from pathlib import Path
import tempfile
import subprocess
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from catalogue_capture_support import CaptureHarness, FIXTURES
from support import load


class CaptureTimingsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.capture = CaptureHarness(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def test_local_capture_skips_install_and_removes_actions_identity(self):
        export = self.capture.export(
            self.capture.envelope(branch="feature", pullRequest=None)
        )
        result = self.capture.run(export, local=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.capture.npm_calls.exists())
        observed = self.capture.observed()
        self.assertEqual(observed["arguments"], ["publish", "--strict", "--config", "mokly.config.json", "--repository", "github.com/mokly-ai/mokly-cloud", "--endpoint", observed["arguments"][7]])
        self.assertRegex(observed["arguments"][7], r"^http://127[.]0[.]0[.]1:[1-9][0-9]*/$")
        self.assertNotIn("Capture timings: ", result.stdout)
        self.assertNotIn("[mokly:timing] ", result.stderr)
        self.assertIsNone(observed["githubActions"])
        self.assertIsNone(observed["headRef"])
        self.assertIsNone(observed["ref"])

    def test_timing_capture_forwards_the_public_flag_and_keeps_exchange_bytes(self):
        export = self.capture.export(self.capture.envelope(branch="feature", pullRequest=None))
        plan = self.capture.plan(export)
        result = self.capture.run(export, plan, local=True, debug_timings=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--debug-timings", self.capture.observed()["arguments"])
        self.assertEqual((self.capture.output / "plan.tar.gz").read_bytes(), plan.read_bytes())
        self.assertEqual(self.capture.stored_blobs(), self.capture.expected_blobs(export))
        line = next(line for line in result.stdout.splitlines() if line.startswith("Capture timings: "))
        values = json.loads(line.removeprefix("Capture timings: "))
        self.assertIsNone(values["headInstallSeconds"])
        self.assertIsInstance(values["totalSeconds"], (int, float))
        self.assertIsInstance(values["publishSeconds"], (int, float))
        self.assertEqual(result.stderr, (FIXTURES / "mokly-publish-timings.stderr.txt").read_text())
        self.assertTrue(self.capture.bearer.is_file())
        self.assertNotIn(self.capture.bearer.read_text(), result.stdout + result.stderr)

    def test_debug_flag_is_explicit_and_off_by_default(self):
        capture = load("capture-catalogue")
        self.assertFalse(capture.parse_arguments(["--local", "--checkout", "."]).debug_timings)
        self.assertTrue(capture.parse_arguments(["--local", "--checkout", ".", "--debug-timings"]).debug_timings)

    def test_pr_timing_capture_records_the_head_install_and_exact_flag_arguments(self):
        export = self.capture.export(self.capture.envelope())
        result = self.capture.run(export, debug_timings=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        observed = self.capture.observed()
        self.assertEqual(observed["arguments"], ["publish", "--strict", "--config", "mokly.config.json", "--repository", "github.com/mokly-ai/mokly-cloud", "--endpoint", observed["arguments"][7], "--debug-timings"])
        self.assertEqual(result.stderr, (FIXTURES / "mokly-publish-timings.stderr.txt").read_text())
        line = next(line for line in result.stdout.splitlines() if line.startswith("Capture timings: "))
        values = json.loads(line.removeprefix("Capture timings: "))
        self.assertEqual(set(values), {"headInstallSeconds", "publishSeconds", "totalSeconds"})
        self.assertIsInstance(values["headInstallSeconds"], (int, float))
        self.assertIsInstance(values["totalSeconds"], (int, float))
        self.assertNotIn(self.capture.bearer.read_text(), result.stdout + result.stderr)

    def test_command_elapsed_time_keeps_the_existing_timeout_and_environment(self):
        capture = load("capture-catalogue")
        environment = {"MOKLY_TOKEN": "fixture-secret"}
        with patch.object(capture.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)) as run, patch.object(
            capture.time, "monotonic", side_effect=[10.0, 12.5]
        ):
            self.assertEqual(capture.run_command(["mokly", "publish"], Path("."), "mokly publish", environment), 2.5)
            run.assert_called_once_with(["mokly", "publish"], cwd=Path("."), env=environment, timeout=900, check=False)

    def test_default_command_failure_remains_the_original_diagnostic(self):
        capture = load("capture-catalogue")
        with patch.object(capture.subprocess, "run", return_value=subprocess.CompletedProcess([], 1)):
            with self.assertRaisesRegex(capture.CaptureError, "^mokly publish failed with exit 1$"):
                capture.run_command(["mokly", "publish"], Path("."), "mokly publish")

    def test_summary_reports_exact_phase_and_total_values_from_a_fake_clock(self):
        capture = load("capture-catalogue")
        configuration = capture.CaptureSettings(self.capture.checkout, self.capture.revision,
            "feature/catalogue", 42, self.capture.revision)
        envelope = self.capture.envelope()

        def exchange(_configuration, _local, directory, _debug):
            (directory / "plan.tar.gz").write_bytes(b"plan")
            return 3.0, 4.0

        output = io.StringIO()
        with patch.object(capture, "CATALOGUE", self.capture.output), patch.object(
            capture, "settings", return_value=configuration
        ), patch.object(capture, "capture_exchange", side_effect=exchange), patch.object(
            capture, "read_plan", return_value=SimpleNamespace(envelope=envelope, files=3, missing={})
        ), patch.object(capture.time, "monotonic", side_effect=[100.0, 110.0]), contextlib.redirect_stdout(output):
            result = capture.main(["preview-pr-42", "--checkout", str(self.capture.checkout),
                                   "--branch", "feature/catalogue", "--debug-timings"])
        self.assertEqual(result, 0)
        line = next(line for line in output.getvalue().splitlines() if line.startswith("Capture timings: "))
        self.assertEqual(json.loads(line.removeprefix("Capture timings: ")), {
            "headInstallSeconds": 3.0, "publishSeconds": 4.0, "totalSeconds": 10.0})
