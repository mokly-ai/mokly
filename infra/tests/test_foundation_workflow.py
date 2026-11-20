"""Only the Foundation workflow applies foundation, and Deploy waits for it."""

import re
import unittest

from support import ROOT


WORKFLOWS = ROOT / ".github/workflows"


def jobs(name):
    """Return each job's text, keyed by job ID, from a workflow file."""
    text = (WORKFLOWS / f"{name}.yml").read_text().split("\njobs:\n", 1)[1]
    parts = re.split(r"^  ([a-z0-9-]+):\n", text, flags=re.MULTILINE)
    return dict(zip(parts[1::2], parts[2::2]))


def needs(job):
    """Return the job IDs that a job lists under needs."""
    match = re.search(r"^    needs:\s*\[([^\]]*)\]", job, re.MULTILINE)
    return set(re.findall(r"[a-z0-9-]+", match[1])) if match else set()


class FoundationWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.text = (WORKFLOWS / "foundation.yml").read_text()
        self.jobs = jobs("foundation")

    def test_foundation_runs_on_main_pushes_and_dispatches_only(self):
        header = self.text.split("\njobs:\n", 1)[0]
        self.assertIn("on:\n  push:\n    branches: [main]\n  workflow_dispatch:\n", header)
        self.assertNotIn("pull_request", header)
        self.assertIn("concurrency:\n  group: foundation-main\n  cancel-in-progress: false\n", header)
        self.assertEqual(sorted(self.jobs), ["apply", "plan", "required"])
        for name in ("plan", "apply"):
            self.assertRegex(self.jobs[name], r"(?m)^    if: github\.ref == 'refs/heads/main'")
        self.assertIn("if [[ \"$REF\" != refs/heads/main ]]; then", self.jobs["required"])

    def test_the_plan_identity_plans_and_publishes_even_a_blocked_plan(self):
        plan = self.jobs["plan"]
        self.assertIn("GCP_SERVICE_ACCOUNT: ${{ secrets.GCP_PLAN_SERVICE_ACCOUNT }}", plan)
        self.assertNotIn("GCP_FOUNDATION_SERVICE_ACCOUNT", plan)
        self.assertIn("run: bash infra/scripts/terraform-foundation.sh plan\n", plan)
        self.assertIn("if: ${{ always() && steps.credentials.outputs.enabled == 'true' }}", plan)
        self.assertIn("name: plan-foundation\n          path: .context/plans/foundation\n", plan)
        for name in ("MKC_REGION", "MKC_DOMAIN", "MKC_CLOUDFLARE_ZONE_ID", "MKC_STATE_BUCKET"):
            self.assertIn(f"{name}: ${{{{ vars.{name} }}}}", plan)
        self.assertIn("MKC_REPOSITORY_ID: ${{ github.repository_id }}", plan)
        self.assertIn("MKC_REPOSITORY_OWNER_ID: ${{ github.repository_owner_id }}", plan)

    def test_the_foundation_identity_applies_the_downloaded_plan(self):
        apply = self.jobs["apply"]
        self.assertEqual(needs(apply), {"plan"})
        self.assertIn("needs.plan.outputs.enabled == 'true'", apply)
        self.assertIn("GCP_SERVICE_ACCOUNT: ${{ secrets.GCP_FOUNDATION_SERVICE_ACCOUNT }}", apply)
        self.assertIn("service_account: ${{ secrets.GCP_FOUNDATION_SERVICE_ACCOUNT }}", apply)
        required_secret = apply.index("GCP_FOUNDATION_SERVICE_ACCOUNT must be configured")
        self.assertLess(required_secret, apply.index("Authenticate the foundation identity"))
        self.assertLess(apply.index("name: plan-foundation"), apply.index("terraform-foundation.sh apply"))
        self.assertEqual(self.text.count("terraform-foundation.sh apply"), 1)
        self.assertNotIn("terraform-environment.sh", self.text)
        self.assertIn("MKC_REPOSITORY_ID: ${{ github.repository_id }}", apply)

    def test_the_required_aggregate_rejects_failed_or_skipped_jobs(self):
        required = self.jobs["required"]
        self.assertEqual(needs(required), {"plan", "apply"})
        self.assertIn("if: ${{ always() }}", required)
        for check in ('test "$PLAN_RESULT" = success', 'test "$APPLY_RESULT" = success',
                      'test "$APPLIED" = true', 'test "$APPLY_RESULT" = skipped'):
            self.assertIn(check, required)

    def test_no_other_workflow_can_apply_foundation(self):
        for path in sorted(WORKFLOWS.glob("*.yml")):
            if path.name != "foundation.yml":
                with self.subTest(workflow=path.name):
                    text = path.read_text()
                    self.assertNotIn("terraform-foundation.sh", text)
                    self.assertNotIn("GCP_FOUNDATION_SERVICE_ACCOUNT", text)

    def test_every_trusted_workflow_ref_names_an_existing_workflow(self):
        module = (ROOT / "infra/terraform/modules/github/main.tf").read_text()
        trusted = set(re.findall(r"\.github/workflows/([a-z-]+)\.yml@refs/heads/main", module))
        self.assertEqual(trusted, {"ci", "deploy", "foundation", "preview"})
        for name in trusted:
            self.assertTrue((WORKFLOWS / f"{name}.yml").is_file(), name)


class DeployWaitTests(unittest.TestCase):
    def setUp(self):
        self.jobs = jobs("deploy")

    def test_the_wait_job_reads_actions_and_holds_no_cloud_credential(self):
        gate = self.jobs["foundation-gate"]
        self.assertIn("if: github.ref == 'refs/heads/main'", gate)
        self.assertIn("      contents: read\n      actions: read\n", gate)
        self.assertNotIn("id-token", gate)
        self.assertNotIn("secrets.", gate)
        self.assertIn("GH_TOKEN: ${{ github.token }}", gate)
        self.assertIn("run: python3 infra/scripts/foundation-gate.py", gate)
        self.assertEqual(needs(gate), set())

    def test_every_credentialed_job_waits_for_foundation(self):
        def ancestors(name):
            found = set()
            for parent in needs(self.jobs[name]):
                found |= {parent} | ancestors(parent)
            return found

        self.assertEqual(needs(self.jobs["publish"]), {"build", "foundation-gate"})
        self.assertEqual(needs(self.jobs["origin-router"]), {"build", "foundation-gate"})
        self.assertEqual(needs(self.jobs["preview-platform"]), {"publish", "origin-router"})
        credentialed = [name for name, job in self.jobs.items() if "id-token: write" in job]
        self.assertIn("apply-main-preview", credentialed)
        for name in credentialed:
            with self.subTest(job=name):
                self.assertIn("foundation-gate", ancestors(name))

    def test_the_required_aggregate_requires_the_wait(self):
        required = self.jobs["required"]
        self.assertIn("foundation-gate", needs(required))
        self.assertIn("FOUNDATION_GATE_RESULT: ${{ needs.foundation-gate.result }}", required)
        self.assertIn('test "$FOUNDATION_GATE_RESULT" = success', required)


if __name__ == "__main__":
    unittest.main()
