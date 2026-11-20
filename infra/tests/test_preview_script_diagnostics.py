"""Preview script entry points contain malformed-environment diagnostics."""

import os
import subprocess
import sys
import tempfile
import unittest

from support import ROOT


REVISION = "a" * 40


class PreviewScriptDiagnosticTests(unittest.TestCase):
    def run_script(self, name, arguments, variables=None):
        environment = dict(os.environ, MKC_REVISION=REVISION)
        if variables is not None:
            environment.update(variables)
        with tempfile.TemporaryDirectory() as temporary:
            return subprocess.run(
                [sys.executable, str(ROOT / "infra/scripts" / name), *arguments],
                cwd=temporary,
                env=environment,
                capture_output=True,
                text=True,
                timeout=30,
            )

    def test_every_entry_point_contains_the_shared_input_error(self):
        cases = (
            (
                "capture-catalogue.py",
                [
                    "preview-pr-0",
                    "--checkout",
                    str(ROOT),
                    "--branch",
                    "feature/catalogue",
                    "--repository",
                    "mokly-ai/mokly",
                ],
                "Catalogue capture failed: environment must match preview-pr-N\n",
            ),
            (
                "preview-comment.py",
                [
                    "--state",
                    "running",
                    "--environment",
                    "preview-pr-0",
                    "--revision",
                    REVISION,
                    "--domain",
                    "example.com",
                    "--catalogue-domain",
                    "catalogues.net",
                    "--run-url",
                    "https://github.com/mokly-ai/mokly-cloud/actions/runs/1",
                    "--repository-private",
                    "true",
                ],
                "Preview comment: environment must match preview-pr-N\n",
            ),
            (
                "preview-lifecycle.py",
                ["validate", "preview-pr-0"],
                "Preview lifecycle failed: environment must match preview-pr-N\n",
            ),
            (
                "preview-seed-job.py",
                ["preview-pr-0", "--run", "123-1"],
                "Preview seed failed: environment must match preview-pr-N\n",
            ),
        )
        for name, arguments, diagnostic in cases:
            with self.subTest(name=name):
                result = self.run_script(
                    name, arguments, {"MKC_DOMAIN": "example.com"}
                )
                self.assertEqual(result.returncode, 1)
                self.assertEqual(result.stdout, "")
                self.assertEqual(result.stderr, diagnostic)
                self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
