"""Environment Terraform plans require exact, committed destructive approvals."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from support import ROOT, load


policy = load("terraform-plan-policy")


class TerraformPlanPolicyTests(unittest.TestCase):
    def repository(self, temporary):
        root = Path(temporary)
        environment = root / "infra/terraform/environment"
        modules = root / "infra/terraform/modules/dns"
        environment.mkdir(parents=True)
        modules.mkdir(parents=True)
        (environment / "main.tf").write_text('module "dns" { source = "../modules/dns" }\n')
        (environment / ".terraform.lock.hcl").write_text("provider-lock\n")
        (modules / "main.tf").write_text('resource "fixture" "this" {}\n')
        return root

    def plan(self, *changes):
        return {
            "format_version": "1.2",
            "resource_changes": [
                {"address": address, "change": {"actions": list(actions)}}
                for address, actions in changes
            ],
        }

    def write_approval(self, root, document, environment=None):
        path = policy.approval_path(root, environment or document["environment"])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(document) + "\n")
        return path

    def test_non_destructive_plan_needs_no_approval(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            for actions in [("no-op",), ("create",), ("read",), ("update",)]:
                with self.subTest(actions=actions):
                    policy.check("main-preview", self.plan(("fixture.this", actions)), root)

    def test_every_delete_shape_requires_an_approval(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            for actions in [("delete",), ("delete", "create"), ("create", "delete")]:
                with self.subTest(actions=actions), self.assertRaisesRegex(
                    policy.PolicyError, "approval is required"
                ):
                    policy.check("production", self.plan(("fixture.this", actions)), root)

    def test_deposed_objects_with_the_same_address_remain_distinct(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            plan = self.plan(("fixture.this", ("delete",)))
            plan["resource_changes"].append(
                {
                    "address": "fixture.this",
                    "deposed": "deadbeef",
                    "change": {"actions": ["delete"]},
                }
            )
            document = policy.approval_document(
                "production", plan, root, "Remove both replaced fixture objects."
            )
            self.assertEqual(document["actions"][1]["deposed"], "deadbeef")
            self.write_approval(root, document)
            policy.check("production", plan, root)

    def test_approval_command_compacts_actions_and_keeps_quoted_content(self):
        with tempfile.TemporaryDirectory() as temporary:
            plan = self.plan(('module.dns.fixture.this["app"]', ("create", "delete")))
            plan["resource_changes"].append(
                {
                    "address": 'module.dns.fixture.this["app"]',
                    "deposed": "deadbeef",
                    "change": {"actions": ["delete"]},
                }
            )
            plan_file = Path(temporary) / "plan.json"
            plan_file.write_text(json.dumps(plan))
            result = subprocess.run(
                [sys.executable, "infra/scripts/terraform-plan-policy.py", "approval",
                 "main-preview", str(plan_file), "--reason",
                 'Replace "app" records in the legacy\\dns zone.\nKeep TXT records.'],
                cwd=ROOT, capture_output=True, timeout=30,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, b"")
        self.assertIn(
            b'  "reason": "Replace \\"app\\" records in the legacy\\\\dns zone.\\nKeep TXT records.",\n'
            b'  "actions": [\n'
            b'    {\n'
            b'      "address": "module.dns.fixture.this[\\"app\\"]",\n'
            b'      "actions": ["create", "delete"]\n'
            b'    },\n'
            b'    {\n'
            b'      "address": "module.dns.fixture.this[\\"app\\"]",\n'
            b'      "actions": ["delete"],\n'
            b'      "deposed": "deadbeef"\n'
            b'    }\n'
            b'  ]\n'
            b'}\n',
            result.stdout,
        )

    def test_unknown_plan_format_or_action_fails_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            plan = self.plan(("fixture.this", ("delete",)))
            plan["format_version"] = "2.0"
            with self.assertRaises(policy.PolicyError):
                policy.check("main-preview", plan, root)
            plan["format_version"] = "1.2"
            plan["resource_changes"][0]["change"]["actions"] = ["destroy"]
            with self.assertRaises(policy.PolicyError):
                policy.check("main-preview", plan, root)

    def test_exact_environment_actions_and_configuration_pass(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            plan = self.plan(
                ('module.dns.fixture.this["app"]', ("delete", "create")),
                ("fixture.old", ("delete",)),
            )
            document = policy.approval_document(
                "main-preview", plan, root, "Rename the stable application records."
            )
            self.write_approval(root, document)
            policy.check("main-preview", plan, root)

    def test_wrong_environment_digest_actions_and_extra_fields_fail_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            plan = self.plan(("fixture.this", ("delete",)))
            base = policy.approval_document(
                "main-preview", plan, root, "Remove the retired fixture."
            )
            cases = [
                dict(base, environment="production"),
                dict(base, configurationDigest="sha256:" + "0" * 64),
                dict(base, actions=[]),
                dict(base, unexpected=True),
            ]
            for document in cases:
                with self.subTest(document=document):
                    path = self.write_approval(root, document, "main-preview")
                    with self.assertRaises(policy.PolicyError):
                        policy.check("main-preview", plan, root)
                    path.unlink()

    def test_stale_approval_blocks_a_non_destructive_plan(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            destructive = self.plan(("fixture.this", ("delete",)))
            document = policy.approval_document(
                "production", destructive, root, "Remove the retired fixture."
            )
            self.write_approval(root, document)
            with self.assertRaisesRegex(policy.PolicyError, "stale"):
                policy.check("production", self.plan(), root)

    def test_duplicate_approval_fields_fail_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            plan = self.plan(("fixture.this", ("delete",)))
            path = policy.approval_path(root, "main-preview")
            path.parent.mkdir(parents=True)
            path.write_text(
                '{"schemaVersion":1,"schemaVersion":1,"environment":"main-preview",'
                '"configurationDigest":"sha256:bad","reason":"Remove the fixture.",'
                '"actions":[]}\n'
            )
            with self.assertRaisesRegex(policy.PolicyError, "repeats field"):
                policy.check("main-preview", plan, root)

    def test_ci_requires_the_approval_to_be_committed_and_unmodified(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self.repository(temporary)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            subprocess.run(["git", "config", "user.email", "test@example.invalid"], cwd=root, check=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=root, check=True)
            subprocess.run(["git", "add", "."], cwd=root, check=True)
            subprocess.run(["git", "commit", "-qm", "baseline"], cwd=root, check=True)
            plan = self.plan(("fixture.this", ("delete",)))
            document = policy.approval_document(
                "main-preview", plan, root, "Remove the retired fixture."
            )
            path = self.write_approval(root, document)
            with self.assertRaisesRegex(policy.PolicyError, "committed"):
                policy.check("main-preview", plan, root, ci=True)
            subprocess.run(["git", "add", str(path.relative_to(root))], cwd=root, check=True)
            subprocess.run(["git", "commit", "-qm", "approve"], cwd=root, check=True)
            policy.check("main-preview", plan, root, ci=True)
            path.write_text(path.read_text() + "\n")
            with self.assertRaisesRegex(policy.PolicyError, "unmodified"):
                policy.check("main-preview", plan, root, ci=True)


if __name__ == "__main__":
    unittest.main()
