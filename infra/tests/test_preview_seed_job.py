"""The trusted release command stages bytes, runs the seed and keeps evidence."""

import contextlib
import io
import json
import os
import re
import tempfile
import unittest
from unittest.mock import patch

from preview_seed_job_support import (
    JOB, LOG_STDERR, LOG_STDOUT, NO_STATUS, PREFIX, RUN, SeedJobDouble,
)
from support import load


seed_job = load("preview-seed-job")


class PreviewSeedJobTests(unittest.TestCase):
    def assert_cleaned(self, commands):
        self.assertFalse((commands.state / "job").exists())
        self.assertFalse((commands.objects / "pr-42/seed/122-1/request.json").exists())
        self.assertEqual((commands.objects / "pr-42/sha256/keep").read_bytes(), b"keep publication")
        calls = commands.calls()
        self.assertLess(calls.index(f"logs job/{JOB}"), calls.index(f"delete job {JOB}"))
        self.assertIn("--cascade=foreground --wait=true --timeout=120s", calls)

    def test_seeded_job_copies_unopened_bytes_and_collects_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            commands = SeedJobDouble(directory)
            catalogue = commands.catalogue(blob_count=64)
            result = commands.run_seed(["--run", RUN, "--catalogue", str(catalogue)])
            self.assertEqual(result.returncode, 0, result.stderr)
            uploads = [
                call for call in commands.calls().splitlines()
                if call.startswith("gcloud storage cp ")
                and not call.startswith("gcloud storage cp gs://")
            ]
            self.assertEqual(len(uploads), 2, "request and catalogue need two upload commands")
            self.assertIn(f"create job {JOB} --from=cronjob/preview-seed", commands.calls())
            self.assertIn("--kubeconfig", commands.calls())
            self.assertIn("--context gke_mokly-508518_us-central1_mkc-autopilot", commands.calls())
            folder = commands.objects / PREFIX
            self.assertEqual(json.loads((folder / "request.json").read_text()), {
                "schemaVersion": 1, "environment": "preview-pr-42", "revision": "a" * 40,
                "pullRequest": 42,
            })
            for source in catalogue.rglob("*"):
                if source.is_file():
                    self.assertEqual((folder / "catalogue" / source.relative_to(catalogue)).read_bytes(), source.read_bytes())
                    self.assertNotIn(source.read_bytes().decode("utf-8", errors="replace"), result.stdout + result.stderr)
            self.assertEqual(
                sorted(str(path.relative_to(folder / "catalogue")) for path in (folder / "catalogue").rglob("*") if path.is_file()),
                sorted(str(path.relative_to(catalogue)) for path in catalogue.rglob("*") if path.is_file()),
            )
            created = json.loads((commands.state / "created-job.json").read_text())
            self.assertEqual(created["spec"]["template"]["spec"]["containers"][0]["args"], ["preview-seed", "--run", RUN])
            self.assertEqual(commands.read_evidence("seed-status.json")["project"], "seeded")
            self.assertEqual(commands.read_evidence("seed-proof.json")["revision"], "a" * 40)
            self.assertIn("preview seed account accepted", result.stdout)
            self.assert_cleaned(commands)

    def test_job_logs_disable_workflow_commands_even_after_partial_failure(self):
        tokens = []
        for mode, expected_exit in (("commands", 0), ("partial-failure", 1)):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                commands = SeedJobDouble(directory)
                result = commands.run_seed(SEED_LOG_MODE=mode)
                self.assertEqual(result.returncode, expected_exit, result.stderr)
                markers = re.findall(r"^::stop-commands::([^\r\n]+)$", result.stdout, re.MULTILINE)
                self.assertEqual(len(markers), 1, result.stdout + result.stderr)
                token = markers[0]
                tokens.append(token)
                self.assertIn(f"\n::{token}::\n", result.stdout)
                before, guarded = result.stdout.split(f"::stop-commands::{token}\n")
                content, after = guarded.split(f"\n::{token}::\n")
                for payload in (LOG_STDOUT, LOG_STDERR):
                    self.assertEqual(content.count(payload), 1)
                    self.assertNotIn(payload, before + after + result.stderr)
                self.assert_cleaned(commands)
        self.assertEqual(len(tokens), 2)
        self.assertNotEqual(tokens[0], tokens[1])

    def test_failed_job_keeps_status_and_cleans_up_without_a_capture(self):
        with tempfile.TemporaryDirectory() as directory:
            commands = SeedJobDouble(directory)
            commands.write_evidence()
            result = commands.run_seed(SEED_SCENARIO="failed")
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn("Preview seed failed:", result.stderr)
            self.assertEqual(commands.read_evidence("seed-status.json")["project"], "failed")
            self.assertFalse((commands.context / "seed-proof.json").exists())
            self.assertFalse((commands.objects / PREFIX / "catalogue").exists())
            self.assertIn("preview seed catalogue missing", result.stdout)
            self.assert_cleaned(commands)

    def test_failed_job_without_status_prints_the_older_revision_message(self):
        with tempfile.TemporaryDirectory() as directory:
            commands = SeedJobDouble(directory)
            result = commands.run_seed(SEED_SCENARIO="no-status")
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertTrue(result.stderr.endswith(NO_STATUS), result.stderr)
            self.assertNotIn("Preview seed failed: The seed wrote no status.", result.stderr)
            self.assertIn("preview seed account accepted", result.stdout)
            self.assert_cleaned(commands)

    def test_status_read_error_keeps_the_provider_failure_and_cleans_up(self):
        with tempfile.TemporaryDirectory() as directory:
            commands = SeedJobDouble(directory)
            result = commands.run_seed(SEED_SCENARIO="no-status", SEED_READ_DENIED="true")
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn("Preview seed failed:", result.stderr)
            self.assertIn("HTTPError 403: Permission denied.", result.stderr)
            self.assertNotIn(NO_STATUS, result.stderr)
            self.assert_cleaned(commands)

    def test_pending_job_times_out_at_the_fake_deadline_and_cleans_up(self):
        with tempfile.TemporaryDirectory() as directory:
            commands = SeedJobDouble(directory)
            ticks = iter((0, 1499, 1499, 1500))
            waits = []

            def sleep(delay):
                self.assertTrue((commands.state / "job").exists())
                self.assertNotIn(f"delete job {JOB}", commands.calls())
                waits.append(delay)

            output, diagnostic = io.StringIO(), io.StringIO()
            previous = os.getcwd()
            try:
                os.chdir(commands.workspace)
                with patch.dict(os.environ, commands.environment(SEED_SCENARIO="pending"), clear=True):
                    with contextlib.redirect_stdout(output), contextlib.redirect_stderr(diagnostic):
                        result = seed_job.main(["preview-pr-42", "--run", RUN], clock=lambda: next(ticks), sleeper=sleep)
            finally:
                os.chdir(previous)
            self.assertEqual(result, 1, diagnostic.getvalue())
            self.assertEqual(waits, [1])
            self.assertIn("Preview seed failed: seed Job did not finish within 25 minutes", diagnostic.getvalue())
            self.assertIn("preview seed account accepted", output.getvalue())
            self.assert_cleaned(commands)


if __name__ == "__main__":
    unittest.main()
