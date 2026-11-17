"""The root wrappers pick tokens, guard CI applies and check the policy on plan and apply."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from support import ROOT


FIXTURES = ROOT / "infra/tests/fixtures/terraform-wrapper"
FOUNDATION_REF = "mokly-ai/mokly-cloud/.github/workflows/foundation.yml@refs/heads/main"
DEPLOY_REF = "mokly-ai/mokly-cloud/.github/workflows/deploy.yml@refs/heads/main"
# Records each call; plan and show replay the recorded Terraform outputs.
TERRAFORM = r'''#!/usr/bin/env python3
import os, sys
from pathlib import Path
with open(os.environ["MKC_TEST_CALLS"], "a") as calls:
    calls.write("terraform " + " ".join(sys.argv[1:]) + "\n")
command = sys.argv[2]
if command == "plan":
    out = next(arg.split("=", 1)[1] for arg in sys.argv if arg.startswith("-out="))
    Path(out).write_bytes(b"recorded binary plan")
    sys.stdout.write(Path(os.environ["MKC_TEST_PLAN_TEXT"]).read_text())
    sys.exit(int(os.environ["MKC_TEST_PLAN_EXIT"]))
if command == "show":
    sys.stdout.write(Path(os.environ["MKC_TEST_SHOW"]).read_text())
'''
GCLOUD = r'''#!/usr/bin/env bash
echo "gcloud $*" >> "$MKC_TEST_CALLS"
printf 'fixture-token'
'''


class WrapperSandbox:
    """A copy of the scripts with recording terraform and gcloud doubles."""

    def __init__(self, temporary):
        self.root = Path(temporary) / "repository"
        shutil.copytree(ROOT / "infra/scripts", self.root / "infra/scripts",
                        ignore=shutil.ignore_patterns("__pycache__"))
        for directory in ("foundation", "environment", "modules/github"):
            (self.root / "infra/terraform" / directory).mkdir(parents=True)
            (self.root / "infra/terraform" / directory / "main.tf").write_text("# fixture\n")
        bin_directory = Path(temporary) / "bin"
        bin_directory.mkdir()
        for name, text in (("terraform", TERRAFORM), ("gcloud", GCLOUD)):
            (bin_directory / name).write_text(text)
            (bin_directory / name).chmod(0o755)
        self.calls = Path(temporary) / "calls.txt"
        self.show = Path(temporary) / "show.json"
        self.environment = dict(
            os.environ, PATH=f"{bin_directory}:{os.environ['PATH']}", GITHUB_ACTIONS="false",
            MKC_TEST_CALLS=str(self.calls), MKC_TEST_SHOW=str(self.show),
            MKC_TEST_PLAN_TEXT=str(FIXTURES / "plan-create.txt"), MKC_TEST_PLAN_EXIT="2",
            MKC_REGION="us-central1", MKC_STATE_BUCKET="state-bucket", MKC_DOMAIN="example.com",
            MKC_CLOUDFLARE_ZONE_ID="a" * 32, MKC_REPOSITORY_ID="123456",
            MKC_REPOSITORY_OWNER_ID="987654", MKC_CATALOGUE_BASE_DOMAIN="catalogues.net",
            MKC_CATALOGUE_CLOUDFLARE_ZONE_ID="b" * 32,
            MKC_NOTIFICATION_CHANNELS='["projects/mokly-508518/notificationChannels/123"]',
        )
        self.plan("show-create.json")

    def plan(self, fixture, address=None, actions=None):
        document = json.loads((FIXTURES / fixture).read_text())
        change = document["resource_changes"][0]
        change["address"] = address or change["address"]
        change["change"]["actions"] = actions or change["change"]["actions"]
        self.show.write_text(json.dumps(document) + "\n")

    def saved_plan(self, name):
        directory = self.root / ".context/plans" / name
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "release.tfplan").write_bytes(b"recorded binary plan")
        return directory

    def run(self, script, *arguments, **environment):
        self.calls.write_text("")
        result = subprocess.run(
            ["bash", f"infra/scripts/{script}", *arguments], cwd=self.root,
            env=dict(self.environment, **environment), capture_output=True, text=True, timeout=30,
        )
        return result, self.calls.read_text().splitlines()


def ci(workflow_ref, event="push", ref="refs/heads/main"):
    return dict(GITHUB_ACTIONS="true", GITHUB_EVENT_NAME=event, GITHUB_REF=ref,
                GITHUB_WORKFLOW_REF=workflow_ref)


class TerraformWrapperTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.sandbox = WrapperSandbox(temporary.name)

    def test_foundation_plan_reads_the_plan_token_and_saves_every_plan_form(self):
        result, calls = self.sandbox.run("terraform-foundation.sh", "plan")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls[0], "gcloud secrets versions access latest "
                         "--secret=mkc-cloudflare-plan-token --project=mokly-508518")
        self.assertIn("-backend-config=bucket=state-bucket -backend-config=prefix=foundation", calls[1])
        self.assertTrue(calls[1].startswith("terraform -chdir=infra/terraform/foundation init"))
        directory = self.sandbox.root / ".context/plans/foundation"
        self.assertIn(f"-out={directory}/release.tfplan", calls[2])
        self.assertEqual(calls[3], f"terraform -chdir=infra/terraform/foundation show -json {directory}/release.tfplan")
        self.assertEqual((directory / "plan.txt").read_text(), (FIXTURES / "plan-create.txt").read_text())
        self.assertEqual(json.loads((directory / "plan.json").read_text())["format_version"], "1.2")
        self.assertEqual(oct(directory.stat().st_mode & 0o777), "0o700")

    def test_foundation_check_exits_two_only_when_the_plan_has_changes(self):
        result, _ = self.sandbox.run("terraform-foundation.sh", "check")
        self.assertEqual(result.returncode, 2)
        self.assertIn("Infrastructure changes detected", result.stderr)
        self.sandbox.plan("show-no-changes.json")
        result, _ = self.sandbox.run("terraform-foundation.sh", "check", MKC_TEST_PLAN_EXIT="0",
                                     MKC_TEST_PLAN_TEXT=str(FIXTURES / "plan-no-changes.txt"))
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_apply_tokens_differ_for_operators_and_the_ci_workflow(self):
        directory = self.sandbox.saved_plan("foundation")
        for environment, token in (({}, "mkc-cloudflare-api-token"),
                                   (ci(FOUNDATION_REF), "mkc-cloudflare-foundation-token"),
                                   (ci(FOUNDATION_REF, "workflow_dispatch"), "mkc-cloudflare-foundation-token")):
            with self.subTest(environment=environment):
                result, calls = self.sandbox.run("terraform-foundation.sh", "apply", **environment)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"--secret={token} ", calls[0])
                self.assertEqual(calls[-2:], [
                    f"terraform -chdir=infra/terraform/foundation show -json {directory}/release.tfplan",
                    f"terraform -chdir=infra/terraform/foundation apply -input=false -lock-timeout=5m {directory}/release.tfplan",
                ])

    def test_ci_apply_accepts_only_its_own_workflow_on_main(self):
        self.sandbox.saved_plan("foundation")
        self.sandbox.saved_plan("main-preview")
        cases = [
            ("terraform-foundation.sh", ["apply"], ci(DEPLOY_REF), "trusted foundation workflow"),
            ("terraform-foundation.sh", ["apply"], ci(FOUNDATION_REF, "pull_request"), "trusted foundation workflow"),
            ("terraform-foundation.sh", ["apply"], ci(FOUNDATION_REF, ref="refs/heads/feature"), "trusted foundation workflow"),
            ("terraform-foundation.sh", ["apply"], ci(FOUNDATION_REF.replace("mokly-ai", "fork")), "trusted foundation workflow"),
            ("terraform-environment.sh", ["main-preview", "apply"], ci(FOUNDATION_REF), "trusted deploy workflow"),
        ]
        for script, arguments, environment, message in cases:
            with self.subTest(script=script, environment=environment):
                result, calls = self.sandbox.run(script, *arguments, **environment)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr)
                self.assertEqual(calls, [], "The guard runs before any provider call")
        result, calls = self.sandbox.run("terraform-environment.sh", "main-preview", "apply", **ci(DEPLOY_REF))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--secret=mkc-cloudflare-apply-token ", calls[0])
        self.assertIn("-backend-config=prefix=environments/main-preview", calls[1])

    def test_policy_blocks_destructive_plans_before_terraform_apply(self):
        self.sandbox.saved_plan("foundation")
        trust = 'module.github.google_service_account.github["plan"]'
        cases = [
            ("show-delete.json", "google_storage_bucket.preview_blobs", {}, "Destructive approval is required"),
            ("show-delete.json", trust, ci(FOUNDATION_REF), "CI never deletes, replaces or forgets trust resource"),
        ]
        for fixture, address, environment, message in cases:
            with self.subTest(address=address):
                self.sandbox.plan(fixture, address)
                result, calls = self.sandbox.run("terraform-foundation.sh", "apply", **environment)
                self.assertEqual(result.returncode, 1)
                self.assertIn(message, result.stderr)
                self.assertFalse([call for call in calls if " apply " in call])

    def test_plans_check_the_policy_and_keep_the_evidence(self):
        self.sandbox.plan("show-delete.json", "terraform_data.retired")
        for script, arguments, name in (("terraform-foundation.sh", ["plan"], "foundation"),
                                        ("terraform-environment.sh", ["production", "plan"], "production")):
            with self.subTest(script=script):
                result, _ = self.sandbox.run(script, *arguments, MKC_TEST_PLAN_TEXT=str(FIXTURES / "plan-delete.txt"))
                self.assertEqual(result.returncode, 1)
                self.assertIn("Destructive approval is required", result.stderr)
                directory = self.sandbox.root / ".context/plans" / name
                self.assertTrue((directory / "plan.json").is_file())
                self.assertEqual((directory / "plan.txt").read_text(), (FIXTURES / "plan-delete.txt").read_text())

    def test_foundation_rejects_bad_arguments_and_inputs_before_provider_calls(self):
        cases = [
            ([], {}, "Supply exactly one action"),
            (["main-preview", "plan"], {}, "Supply exactly one action"),
            (["destroy-plan"], {}, "Unknown plan action"),
            (["main-preview"], {}, "Unknown plan action"),
            (["plan"], {"MKC_REPOSITORY_ID": "mokly-ai/mokly-cloud"}, "must be numeric GitHub IDs"),
            (["plan"], {"MKC_REPOSITORY_OWNER_ID": "0"}, "must be numeric GitHub IDs"),
            (["plan"], {"MKC_DOMAIN": "Example.com"}, "Invalid domain"),
            (["plan"], {"MKC_REGION": "central"}, "Invalid region"),
        ]
        for arguments, environment, message in cases:
            with self.subTest(arguments=arguments, environment=environment):
                result, calls = self.sandbox.run("terraform-foundation.sh", *arguments, **environment)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr)
                self.assertEqual(calls, [])
        result, calls = self.sandbox.run("terraform-foundation.sh", "plan", MKC_REPOSITORY_ID="")
        self.assertIn("Set MKC_REPOSITORY_ID", result.stderr)
        self.assertEqual(calls, [])

    def test_apply_requires_a_saved_plan(self):
        result, calls = self.sandbox.run("terraform-foundation.sh", "apply")
        self.assertEqual(result.returncode, 1)
        self.assertIn("Run plan and review plan.txt before apply", result.stderr)
        self.assertFalse([call for call in calls if " apply " in call or " show " in call])


if __name__ == "__main__":
    unittest.main()
