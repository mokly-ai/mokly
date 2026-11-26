"""Security and deployment regression contracts; no cloud reconciliation mocks."""

import re
import unittest

from support import ROOT


class CorrectionTests(unittest.TestCase):
    def test_only_the_stable_deploy_workflow_applies_infrastructure(self):
        deploy = (ROOT / ".github/workflows/deploy.yml").read_text()
        preview = (ROOT / ".github/workflows/preview.yml").read_text()
        self.assertEqual(len(re.findall(r"terraform-environment.sh.*apply", deploy)), 2)
        self.assertNotRegex(preview, r"terraform-environment.sh.*apply")
        for text in (deploy, preview):
            self.assertNotIn("bootstrap-preview.sh", text)

    def test_root_plans_and_applies_enforce_the_destructive_action_policy(self):
        script = (ROOT / "infra/scripts/terraform-root.sh").read_text()
        self.assertEqual(script.count('terraform-plan-policy.py check "$policy_root"'), 2)
        self.assertEqual(script.count('show -json "$plan_directory/release.tfplan"'), 2)
        for wrapper in ("terraform-environment.sh", "terraform-foundation.sh"):
            with self.subTest(wrapper=wrapper):
                text = (ROOT / f"infra/scripts/{wrapper}").read_text()
                self.assertEqual(text.count("source infra/scripts/terraform-root.sh"), 1)
                self.assertEqual(text.count('terraform_root "$action"'), 1)

    def test_log_alert_policies_require_logging_notification_rule_permissions(self):
        policies = []
        for path in sorted((ROOT / "infra/terraform/environment").glob("*.tf")):
            for name, body in re.findall(
                r'resource\s+"google_monitoring_alert_policy"\s+"([^"]+)"\s*\{(.*?)^\}',
                path.read_text(), re.DOTALL | re.MULTILINE,
            ):
                if re.search(r"\bcondition_matched_log\s*\{", body):
                    policies.append((path.name, name))
        self.assertTrue(policies, "The environment must include its log-based alerts.")
        foundation = (ROOT / "infra/terraform/foundation/permissions.tf").read_text()
        permission_list = re.search(
            r"environment_apply_permissions\s*=\s*\[(.*?)\]", foundation, re.DOTALL,
        )
        self.assertIsNotNone(permission_list)
        permissions = set(re.findall(r'"([^"]+)"', permission_list[1]))
        required = {f"logging.notificationRules.{action}"
                    for action in ("create", "delete", "get", "list", "update")}
        for filename, name in policies:
            with self.subTest(file=filename, policy=name):
                self.assertFalse(
                    required - permissions,
                    "Environment apply lacks log alert permissions: "
                    + ", ".join(sorted(required - permissions)),
                )

    def test_docker_contract(self):
        docker = (ROOT / "infra/docker/mkc-api.Dockerfile").read_text()
        rust = (ROOT / "rust-toolchain.toml").read_text()
        version = re.search(r'channel = "([^"]+)"', rust)[1]
        self.assertIn(f"ARG RUST_VERSION={version}", docker)
        self.assertIn("USER 65532:65532", docker)
        self.assertIn('CMD ["serve"]', docker)
        entry = (ROOT / "infra/docker/entrypoint.sh").read_text()
        self.assertIn('exec "${MKC_API_BIN:-/usr/local/bin/mkc-api}" "$@"', entry)
        cli = (ROOT / "crates/mkc-api/src/cli.rs").read_text()
        self.assertIn("Migrate", cli)
        self.assertIn("Serve", cli)

    def test_helm_prerequisites_are_hooks_without_adoption(self):
        for name, hooks in (("bootstrap", 3), ("network-policy", 1)):
            with self.subTest(template=name):
                text = (ROOT / f"infra/helm/mokly-cloud/templates/{name}.yaml").read_text()
                self.assertEqual(text.count("helm.sh/hook: pre-install,pre-upgrade"), hooks)
                self.assertEqual(text.count('helm.sh/hook-weight: "-5"'), hooks)
                self.assertEqual(text.count("helm.sh/hook-delete-policy: before-hook-creation"), hooks)
                self.assertNotIn("meta.helm.sh/release", text)
                self.assertNotIn("app.kubernetes.io/managed-by: Helm", text)
        self.assertNotIn("--show-only templates/bootstrap.yaml",
                         (ROOT / "infra/scripts/rollout.sh").read_text())
        reset = (ROOT / "infra/helm/mokly-cloud/templates/database-reset.yaml").read_text()
        self.assertEqual(reset.count("helm.sh/hook: pre-install,pre-upgrade"), 2)
        self.assertEqual(reset.count('helm.sh/hook-weight: "-1"'), 1)
        self.assertEqual(reset.count('helm.sh/hook-weight: "1"'), 1)
        self.assertEqual(reset.count("serviceAccountName: reset"), 1)
        self.assertEqual(reset.count("serviceAccountName: api"), 1)
        self.assertNotIn("dropdb", reset)
        rollout = (ROOT / "infra/scripts/rollout.sh").read_text()
        self.assertIn("gcloud sql databases delete mokly", rollout)
        self.assertIn("gcloud sql databases create mokly", rollout)
        self.assertIn("--impersonate-service-account=\"$reset_identity\"", rollout)

    def test_service_accounts_disable_token_automount(self):
        text = (ROOT / "infra/helm/mokly-cloud/templates/bootstrap.yaml").read_text()
        self.assertIn("automountServiceAccountToken: false", text)
        self.assertEqual(text.count("automountServiceAccountToken:"), 2)

    def test_bootstrap_cannot_destroy_state(self):
        # Terraform does not expose lifecycle.prevent_destroy as a test expression.
        text = (ROOT / "infra/terraform/bootstrap/main.tf").read_text()
        self.assertRegex(text, r"lifecycle\s*{\s*prevent_destroy\s*=\s*true")

    def test_gke_supported_ingress_annotation(self):
        # GKE explicitly ignores ingressClassName; keep its required annotation.
        for environment in ("production", "main-preview"):
            text = (ROOT / f"infra/helm/tests/golden/{environment}.yaml").read_text()
            self.assertIn("kubernetes.io/ingress.class: gce", text)
            self.assertNotIn("ingressClassName:", text)
        preview = (ROOT / "infra/helm/tests/golden/preview-pr.yaml").read_text()
        self.assertIn("ingressClassName: mkc-preview", preview)
        self.assertNotIn("kubernetes.io/ingress.class:", preview)
