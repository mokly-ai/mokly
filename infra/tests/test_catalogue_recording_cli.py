"""Capture recordings use one selected published CLI installation."""

from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from support import load

recorder = load("record-catalogue-capture")
from publication_smoke_consumer import PublishedCli


class RecordingCliTests(unittest.TestCase):
    def test_recording_reuses_one_installation_for_sources_outcomes_and_timings(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            cli = PublishedCli(workspace / "consumer", workspace / "consumer/bin/mokly", "9.8.7")
            checkout = workspace / "checkout"
            result = subprocess.CompletedProcess([], 0, b"published\n", b"")
            with patch.object(recorder, "require_dependencies"), patch.object(
                recorder, "install_published_cli", return_value=cli
            ) as install, patch.object(
                recorder, "_prepare_isolated_checkout", return_value=checkout
            ) as prepare, patch.object(
                recorder, "record_cases", return_value={"success": result}
            ) as cases, patch.object(
                recorder, "record_timing", return_value=b"timings\n"
            ) as timing:
                streams = recorder.captured_files(workspace)
            install.assert_called_once_with(workspace)
            prepare.assert_called_once_with(recorder.ROOT, workspace, cli)
            cases.assert_called_once_with(checkout, workspace, cli)
            timing.assert_called_once_with(checkout, workspace, cli)
            self.assertEqual(streams, {
                "mokly-publish-success.exit.txt": b"0\n",
                "mokly-publish-success.stdout.txt": b"published\n",
                "mokly-publish-success.stderr.txt": b"",
                "mokly-publish-timings.stderr.txt": b"timings\n",
            })


if __name__ == "__main__":
    unittest.main()
