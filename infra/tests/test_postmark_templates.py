"""Run the Postmark protocol doubles and guard the trusted sync wiring."""

import re
import subprocess
import unittest

from support import ROOT


class PostmarkTemplateTests(unittest.TestCase):
    def test_postmark_http_contracts(self):
        result = subprocess.run(
            ["node", "--test", "infra/tests/postmark_templates.test.mjs"],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_sync_uses_trusted_deploy_with_dedicated_token_reader(self):
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text()
        self.assertIn("on:\n  push:\n    branches: [main]", workflow)
        self.assertIn("GCP_POSTMARK_SYNC_SERVICE_ACCOUNT", workflow)
        self.assertIn("sync-postmark-environment.sh", workflow)
        preview = workflow.split("  sync-main-preview-email:\n", 1)[1].split("  release-main-preview:\n", 1)[0]
        production = workflow.split("  sync-production-email:\n", 1)[1].split("  release-production:\n", 1)[0]
        self.assertIn("needs: [apply-main-preview]", preview)
        self.assertIn("needs: [apply-production]", production)
        self.assertIn("npm run emails:check", preview)
        self.assertIn("npm run emails:check", production)
        self.assertIn("bash infra/scripts/sync-postmark-environment.sh main-preview", preview)
        self.assertIn("bash infra/scripts/sync-postmark-environment.sh production", production)
        for job, expected in [
            ("release-main-preview", "[apply-main-preview,catalogue-main-preview,sync-main-preview-email]"),
            ("release-production", "[release-main-preview,apply-production,catalogue-production,sync-production-email]"),
        ]:
            release = workflow.split(f"  {job}:\n", 1)[1]
            needs = release.split("    needs:", 1)[1].split("    if:", 1)[0]
            self.assertEqual(re.sub(r"\s+", "", needs).replace(",]", "]"), expected)
        shell = (ROOT / "infra/scripts/sync-postmark-environment.sh").read_text()
        self.assertIn("sync-postmark-templates.mjs", shell)
        self.assertIn('mkc-${environment}-postmark-token', shell)
        self.assertNotIn("sync-postmark-templates.mjs", (ROOT / ".github/workflows/ci.yml").read_text())
        github = (ROOT / "infra/terraform/modules/github/main.tf").read_text()
        self.assertIn('postmark = ["deploy"]', github)
        permissions = (ROOT / "infra/terraform/foundation/environments.tf").read_text()
        self.assertIn('module.github.emails["postmark"]', permissions)
        self.assertIn('module.secrets[each.key].ids["postmark-token"]', permissions)


if __name__ == "__main__":
    unittest.main()
