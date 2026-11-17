"""Installed version, recorded refusals and actionable smoke prerequisites."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publication_smoke_cli as smoke_cli
from smoke_publications import smoke


ROOT = Path(__file__).resolve().parents[3]


class SmokePrerequisites(unittest.TestCase):
    def test_version_comes_from_installed_package_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / "node_modules/@mokly/mokly/package.json"
            package.parent.mkdir(parents=True)
            package.write_text(json.dumps({"version": "9.8.7"}))
            self.assertEqual(smoke_cli._published_cli(root), "@mokly/mokly@9.8.7")

    def test_published_cli_receives_canonical_repository_identity(self):
        command = smoke_cli._publish_command("@mokly/mokly@9.8.7")
        self.assertEqual(command[command.index("--repository") + 1], "github.com/mokly-ai/mokly-cloud")
        self.assertIn("@mokly/mokly@9.8.7", command)
        self.assertIn("--strict", command)
        self.assertEqual(command[command.index("--base") + 1], "HEAD~1")
        self.assertEqual(command[command.index("--config") + 1], "mokly.config.json")
        self.assertNotIn("--out", command)

    def test_missing_dependencies_fail_before_fixture_or_signup(self):
        with patch("publication_smoke_fixture.Path.is_file", return_value=False), patch(
            "smoke_publications.Path.read_bytes", side_effect=AssertionError("fixture reached before prerequisites")
        ):
            with self.assertRaisesRegex(AssertionError, r"^Missing publication smoke dependencies; run npm ci$"):
                smoke(Mock(), Mock(), "test-process")

    def test_missing_npm_dependencies_fail_before_api_with_one_line_remedy(self):
        with patch("publication_smoke_fixture.Path.is_file", return_value=False), patch(
            "publication_smoke_cli.project_and_token", side_effect=AssertionError("API reached before prerequisite check")
        ):
            with self.assertRaisesRegex(AssertionError, r"^Missing publication smoke dependencies; run npm ci$"):
                smoke_cli.cli_smoke(Mock(), Mock(), Mock())

    def test_temporary_directory_creates_workspace_context(self):
        with patch("publication_smoke_fixture.Path.is_file", return_value=True), patch(
            "publication_smoke_cli._published_cli", return_value="@mokly/mokly@9.8.7"
        ), patch("publication_smoke_cli.Path.mkdir") as mkdir, patch(
            "publication_smoke_cli.project_and_token", return_value=({"id": "org", "name": "test"}, {}, {})
        ), patch("publication_smoke_cli.tempfile.TemporaryDirectory", side_effect=RuntimeError("temporary directory reached")) as temporary:
            with self.assertRaisesRegex(RuntimeError, "temporary directory reached"):
                smoke_cli.cli_smoke(Mock(), Mock(), Mock())
            mkdir.assert_called_once_with(parents=True, exist_ok=True)
            self.assertEqual(temporary.call_args.kwargs["dir"].name, ".context")


class RecordedRefusalTests(unittest.TestCase):
    def setUp(self):
        self.code, self.stdout, self.stderr = smoke_cli._recorded_refusal(ROOT, "git-uncommitted")

    def result(self, **changes):
        values = {"returncode": self.code, "stdout": self.stdout.decode(), "stderr": self.stderr.decode()}
        values.update(changes)
        return subprocess.CompletedProcess([], **values)

    def test_exact_recording_and_only_leading_npm_notices_or_warnings_pass(self):
        for prefix in ["", "npm warn test warning\n", "npm notice test notice\nnpm warn another warning\n"]:
            with self.subTest(prefix=prefix):
                smoke_cli._require_recorded_refusal(self.result(stderr=prefix + self.stderr.decode()), ROOT, "git-uncommitted")

    def test_cli_drift_fails_with_the_exit_stdout_and_stderr(self):
        cases = [{"returncode": 0}, {"returncode": 2}, {"stdout": "unexpected stdout\n"},
                 {"stderr": "unexpected stderr\n"}, {"stderr": "unexpected\n" + self.stderr.decode()},
                 {"stderr": self.stderr.decode() + "npm warn trailing\n"}]
        for changes in cases:
            with self.subTest(changes=changes):
                result = self.result(**changes)
                with self.assertRaises(AssertionError) as failure:
                    smoke_cli._require_recorded_refusal(result, ROOT, "git-uncommitted")
                for text in [f"exit {result.returncode}", "stdout:\n" + result.stdout, "stderr:\n" + result.stderr]:
                    self.assertIn(text, str(failure.exception))

    def test_recording_drift_fails_on_each_stream_and_exit(self):
        cases = [(self.code + 1, self.stdout, self.stderr), (self.code, b"changed\n", self.stderr),
                 (self.code, self.stdout, self.stderr + b"changed\n")]
        for recorded in cases:
            with self.subTest(recorded=recorded), patch.object(smoke_cli, "_recorded_refusal", return_value=recorded):
                with self.assertRaises(AssertionError):
                    smoke_cli._require_recorded_refusal(self.result(), ROOT, "git-uncommitted")


if __name__ == "__main__":
    unittest.main()
