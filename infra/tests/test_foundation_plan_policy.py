"""Foundation plans use their own approval and CI never removes trust resources."""

import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

from support import ROOT, load
import terraform_plan_roots as roots


policy = load("terraform-plan-policy")
DESTRUCTIVE = [("delete",), ("delete", "create"), ("create", "delete"), ("forget",)]
TRUST_ADDRESSES = [
    "module.github.google_iam_workload_identity_pool.github",
    "module.github.google_iam_workload_identity_pool_provider.github",
    'module.github.google_service_account.github["foundation"]',
    'module.github.google_service_account_iam_member.github["plan/foundation"]',
    "google_project_iam_custom_role.foundation_apply",
    "google_project_iam_custom_role.foundation_plan",
    "google_project_iam_member.foundation_apply",
    "google_project_iam_member.foundation_plan",
    'google_project_iam_member.plan["roles/compute.viewer"]',
    'google_storage_bucket_iam_member.state["foundation"]',
    "google_secret_manager_secret.cloudflare_plan",
    "google_secret_manager_secret.cloudflare_foundation",
    "google_secret_manager_secret_iam_member.cloudflare_plan",
    "google_secret_manager_secret_iam_member.cloudflare_foundation",
]


class FoundationPlanPolicyTests(unittest.TestCase):
    def repository(self, temporary):
        root = Path(temporary)
        for directory, text in (
            ("infra/terraform/foundation", 'module "github" { source = "../modules/github" }\n'),
            ("infra/terraform/environment", 'module "dns" { source = "../modules/dns" }\n'),
            ("infra/terraform/modules/github", 'resource "fixture" "this" {}\n'),
        ):
            (root / directory).mkdir(parents=True)
            (root / directory / "main.tf").write_text(text)
        return root

    def plan(self, *changes):
        resources = []
        for address, actions, *extra in changes:
            resource = {"address": address, "change": {"actions": list(actions)}}
            resource.update(*extra)
            resources.append(resource)
        return {"format_version": "1.2", "resource_changes": resources}

    def approve(self, root, plan, name="foundation"):
        document = policy.approval_document(name, plan, root, "Remove the retired fixture.")
        path = policy.approval_path(root, name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(document) + "\n")
        return path

    def commit(self, root):
        for command in (["init", "-q"], ["config", "user.email", "test@example.invalid"],
                        ["config", "user.name", "Test"], ["add", "."], ["commit", "-qm", "fixture"]):
            subprocess.run(["git", *command], cwd=root, check=True)

    def test_foundation_approval_path_and_digest_cover_only_its_sources(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            self.assertEqual(
                policy.approval_path(root, "foundation"),
                root / "infra/terraform/foundation/destructive-approvals/foundation.json",
            )
            foundation = policy.configuration_digest(root, "foundation")
            environment = policy.configuration_digest(root, "main-preview")
            (root / "infra/terraform/environment/main.tf").write_text("# changed\n")
            self.assertEqual(policy.configuration_digest(root, "foundation"), foundation)
            self.assertNotEqual(policy.configuration_digest(root, "main-preview"), environment)
            (root / "infra/terraform/modules/github/main.tf").write_text("# changed\n")
            self.assertNotEqual(policy.configuration_digest(root, "foundation"), foundation)
            changed = policy.configuration_digest(root, "foundation")
            (root / "infra/terraform/foundation/main.tf").write_text("# changed\n")
            self.assertNotEqual(policy.configuration_digest(root, "foundation"), changed)

    def test_foundation_needs_its_own_exact_approval(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            plan = self.plan(("google_storage_bucket.preview_blobs", ("delete",)))
            with self.assertRaisesRegex(policy.PolicyError, "approval is required"):
                policy.check("foundation", plan, root)
            self.approve(root, plan, "main-preview")
            with self.assertRaisesRegex(policy.PolicyError, "approval is required"):
                policy.check("foundation", plan, root)
            path = self.approve(root, plan)
            self.assertEqual(json.loads(path.read_text())["environment"], "foundation")
            policy.check("foundation", plan, root)
            document = json.loads(path.read_text())
            path.write_text(json.dumps(dict(document, environment="main-preview")) + "\n")
            with self.assertRaisesRegex(policy.PolicyError, "environment does not match"):
                policy.check("foundation", plan, root)

    def test_stale_foundation_approval_blocks_the_next_plan(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            self.approve(root, self.plan(("google_storage_bucket.preview_blobs", ("delete",))))
            with self.assertRaisesRegex(policy.PolicyError, "stale"):
                policy.check("foundation", self.plan(), root)

    def test_ci_refuses_every_destructive_change_of_a_trust_resource(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            for address in TRUST_ADDRESSES:
                for actions in DESTRUCTIVE:
                    plan = self.plan((address, actions))
                    path = self.approve(root, plan)
                    with self.subTest(address=address, actions=actions), self.assertRaisesRegex(
                        policy.PolicyError, "CI never deletes, replaces or forgets trust resource"
                    ):
                        policy.check("foundation", plan, root, ci=True)
                    policy.check("foundation", plan, root)
                    path.unlink()

    def test_ci_refuses_deposed_and_moved_trust_objects(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            provider = "module.github.google_iam_workload_identity_pool_provider.github"
            moved = ("google_project_iam_member.reader", ("delete", "create"),
                     {"previous_address": "google_project_iam_member.foundation_plan"})
            for plan in (self.plan((provider, ("delete",), {"deposed": "deadbeef"})), self.plan(moved)):
                with self.subTest(plan=plan), self.assertRaisesRegex(policy.PolicyError, "trust resource"):
                    policy.check("foundation", plan, root, ci=True)
            invalid = self.plan((provider, ("update",), {"previous_address": ""}))
            with self.assertRaisesRegex(policy.PolicyError, "invalid previous address"):
                policy.check("foundation", invalid, root, ci=True)

    def test_ci_creates_updates_and_reads_trust_resources(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            for address in TRUST_ADDRESSES:
                for actions in (("create",), ("update",), ("read",), ("no-op",)):
                    with self.subTest(address=address, actions=actions):
                        policy.check("foundation", self.plan((address, actions)), root, ci=True)

    def test_ci_applies_committed_approvals_for_resources_outside_the_trust_set(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            plan = self.plan(
                ("google_storage_bucket.preview_blobs", ("delete", "create")),
                ('google_project_iam_member.deploy["roles/container.developer"]', ("delete",)),
                ('module.github_mirror.google_service_account.github["plan"]', ("delete",)),
            )
            self.approve(root, plan)
            self.commit(root)
            policy.check("foundation", plan, root, ci=True)

    def test_environment_roots_have_no_trust_set(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            plan = self.plan(('module.github.google_service_account.github["plan"]', ("delete",)))
            with self.assertRaisesRegex(policy.PolicyError, "approval is required"):
                policy.check("main-preview", plan, root, ci=True)

    def test_unknown_roots_fail_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            for name in ("bootstrap", "preview-pr-42", ""):
                with self.subTest(name=name), self.assertRaisesRegex(
                    policy.PolicyError, "accepts only the foundation, main-preview, production roots"
                ):
                    policy.check(name, self.plan(), root)

    def test_every_trust_entry_names_a_declared_foundation_resource(self):
        text = "\n".join(
            path.read_text() for path in sorted((ROOT / "infra/terraform/foundation").glob("*.tf"))
        )
        declared = {f"{kind}.{name}" for kind, name in
                    re.findall(r'^resource\s+"([^"]+)"\s+"([^"]+)"', text, re.MULTILINE)}
        declared |= {f"module.{name}" for name in re.findall(r'^module\s+"([^"]+)"', text, re.MULTILINE)}
        self.assertEqual(sorted(set(roots.FOUNDATION_TRUST) - declared), [])

    def test_approval_generation_warns_that_ci_refuses_trust_removals(self):
        with tempfile.TemporaryDirectory() as temporary:
            plan_file = Path(temporary) / "plan.json"
            plan_file.write_text(json.dumps(self.plan((TRUST_ADDRESSES[0], ("delete",)))))
            result = subprocess.run(
                [sys.executable, "infra/scripts/terraform-plan-policy.py", "approval",
                 "foundation", str(plan_file), "--reason", "Remove the retired pool."],
                cwd=ROOT, capture_output=True, text=True, timeout=30,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("CI refuses this plan", result.stderr)
        self.assertEqual(json.loads(result.stdout)["environment"], "foundation")


if __name__ == "__main__":
    unittest.main()
