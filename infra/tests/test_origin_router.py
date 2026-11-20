"""Origin-router deployment reads its provider token through trusted GCP identity."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from support import ROOT


class OriginRouterDeployTests(unittest.TestCase):
    def run_script(self, gcloud_status=0, empty=False):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        directory = Path(temporary.name)
        calls = directory / "calls"
        gcloud = directory / "gcloud"
        gcloud.write_text(
            "#!/usr/bin/env bash\n"
            "set -euo pipefail\n"
            "printf 'gcloud %s\\n' \"$*\" >> \"$CALLS\"\n"
            "[[ \"$*\" == 'secrets versions access latest --project=mokly-508518 --secret=mkc-cloudflare-worker-token --out-file='* ]]\n"
            "for argument in \"$@\"; do\n"
            "  [[ \"$argument\" != --out-file=* ]] || output=${argument#--out-file=}\n"
            "done\n"
            "[[ ${GCLOUD_STATUS:-0} == 0 ]] || exit \"$GCLOUD_STATUS\"\n"
            "[[ ${EMPTY_TOKEN:-false} == true ]] || printf 'fixture-worker-token' > \"$output\"\n"
        )
        gcloud.chmod(0o755)
        npm = directory / "npm"
        npm.write_text(
            "#!/usr/bin/env bash\n"
            "set -euo pipefail\n"
            "[[ \"${CLOUDFLARE_API_TOKEN:-}\" == fixture-worker-token ]]\n"
            "printf 'npm %s token-present\\n' \"$*\" >> \"$CALLS\"\n"
        )
        npm.chmod(0o755)
        result = subprocess.run(
            ["bash", "infra/scripts/deploy-origin-router.sh"],
            cwd=ROOT,
            env=dict(
                os.environ,
                PATH=str(directory) + ":" + os.environ["PATH"],
                CALLS=str(calls),
                GCLOUD_STATUS=str(gcloud_status),
                EMPTY_TOKEN="true" if empty else "false",
            ),
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result, calls.read_text() if calls.exists() else ""

    def test_fetches_the_dedicated_secret_and_scopes_it_to_wrangler(self):
        result, calls = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--secret=mkc-cloudflare-worker-token", calls)
        self.assertIn(
            "npm exec --workspace @mokly-cloud/worker -- wrangler deploy token-present",
            calls,
        )
        self.assertNotIn("fixture-worker-token", result.stdout + result.stderr)

    def test_provider_failure_and_empty_secret_stop_before_wrangler(self):
        for status, empty, diagnostic in (
            (23, False, ""),
            (0, True, "Worker credential is empty"),
        ):
            with self.subTest(status=status, empty=empty):
                result, calls = self.run_script(gcloud_status=status, empty=empty)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("npm ", calls)
                self.assertIn(diagnostic, result.stderr)


if __name__ == "__main__":
    unittest.main()
