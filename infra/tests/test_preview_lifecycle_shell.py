"""End-to-end shell ordering, rollback and retry behavior for PR previews."""

from pathlib import Path
import tempfile
import unittest

from preview_lifecycle_support import LifecycleDouble, VERIFIER


class DeployShellTests(unittest.TestCase):
    def test_platform_readiness_failure_stops_before_cluster_or_mutation(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            result = double.run("preview-deploy.sh", PLATFORM_READY_STATUS="2")
            calls = double.calls()
        self.assertEqual(result.returncode, 2)
        self.assertEqual(calls, "platform-ready\n")

    def test_deploy_and_redeploy_preserve_secrets_and_use_exact_budgets(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            first = double.run("preview-deploy.sh")
            second = double.run("preview-deploy.sh")
            calls = double.calls()
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(calls.count("platform-ready"), 2)
        self.assertEqual(calls.count("create secret generic postgres-credentials"), 1)
        self.assertEqual(calls.count("create secret generic catalogue-signing-key"), 1)
        self.assertIn("smoke timeout=900 desktop=false", calls)
        self.assertIn("smoke timeout=60 desktop=false", calls)
        self.assertEqual(calls.count("lifecycle dns-upsert"), 2)
        self.assertEqual(calls.count("lifecycle iam-upsert"), 2)
        self.assertIn("--wait --timeout 15m", calls)
        self.assertIn("certificate/catalogue-tls --timeout=900s", calls)
        self.assertNotIn("fixture-catalogue-token", calls + first.stdout + first.stderr)

    def test_create_conflict_rereads_and_validates_the_winner(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            result = double.run("preview-deploy.sh", SECRET_CONFLICT="postgres-credentials")
            calls = double.calls()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreaterEqual(calls.count("get secret postgres-credentials"), 2)
        self.assertIn("helm upgrade --install", calls)

    def test_pvc_with_either_missing_secret_stops_before_external_mutation(self):
        for present, missing in (
            (("postgres-secret",), "catalogue-signing-key"),
            (("signing-secret",), "postgres-credentials"),
        ):
            with self.subTest(missing=missing), tempfile.TemporaryDirectory() as temporary:
                double = LifecycleDouble(temporary)
                double.prime("namespace", "pvc", *present)
                result = double.run("preview-deploy.sh")
                calls = double.calls()
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(f"Secret/{missing} is missing", result.stderr)
            self.assertNotIn("lifecycle dns-upsert", calls)
            self.assertNotIn("helm upgrade", calls)

    def test_verifier_is_copied_privately_before_helm_and_only_once(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            first = double.run("preview-deploy.sh")
            second = double.run("preview-deploy.sh")
            calls = double.calls()
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual(double.stored_verifier(), VERIFIER)
            fetches = [
                line for line in calls.splitlines()
                if line.startswith("gcloud secrets versions access latest")
                and "--secret=mkc-preview-sign-in-password" in line
            ]
            self.assertEqual(len(fetches), 2)
            for fetch in fetches:
                file = Path(fetch.split("--out-file=", 1)[1])
                self.assertTrue(file.is_relative_to(Path(temporary)))
                self.assertFalse(file.exists())
        self.assertEqual(calls.count("verifier file mode=600"), 2)
        self.assertEqual(calls.count("create -f "), 1)
        self.assertNotIn("replace -f ", calls)
        self.assertLess(calls.index("create -f "), calls.index("helm upgrade --install"))
        self.assertNotIn("rollout restart", calls)
        self.assertNotIn(VERIFIER.decode(), calls + first.stdout + first.stderr + second.stdout + second.stderr)

    def test_changed_verifier_restarts_only_when_helm_kept_the_api_pod(self):
        for helm_rolled in ("false", "true"):
            with self.subTest(helm_rolled=helm_rolled), tempfile.TemporaryDirectory() as temporary:
                double = LifecycleDouble(temporary)
                double.prime("namespace", "pvc", "postgres-secret", "signing-secret", "release", "preview-secret")
                result = double.run("preview-deploy.sh", HELM_ROLLS_API=helm_rolled)
                calls = double.calls()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(double.stored_verifier(), VERIFIER)
                self.assertEqual(calls.count("replace -f "), 1)
                steps = ["replace -f ", "helm upgrade --install"]
                if helm_rolled == "false":
                    self.assertEqual(calls.count("rollout restart deployment/api"), 1)
                    steps.extend(["rollout restart deployment/api", "rollout status deployment/api"])
                else:
                    self.assertNotIn("rollout restart", calls)
                    self.assertNotIn("rollout status", calls)
                steps.extend(["certificate/catalogue-tls", "smoke timeout=60"])
                positions = [calls.index(step) for step in steps]
                self.assertEqual(positions, sorted(positions))

    def test_retry_restarts_the_old_pod_after_the_secret_changed_before_helm_failed(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            double.prime("namespace", "pvc", "postgres-secret", "signing-secret", "release", "preview-secret")
            failed = double.run("preview-deploy.sh", HELM_UPGRADE_STATUS="7")
            result = double.run("preview-deploy.sh")
            self.assertEqual(double.stored_verifier(), VERIFIER)
            calls = double.calls()
        self.assertEqual(failed.returncode, 7, failed.stderr)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count("replace -f "), 1)
        self.assertEqual(calls.count("rollout restart deployment/api"), 1)
        self.assertLess(calls.rindex("helm upgrade --install"), calls.index("rollout restart deployment/api"))

    def test_missing_or_invalid_verifier_warns_and_removes_the_key(self):
        missing = "mkc-preview-sign-in-password has no versions"
        invalid = "mkc-preview-sign-in-password contains an invalid preview verifier"
        cases = (
            ("empty store", "no-versions", VERIFIER, missing),
            ("empty store in Actions", "no-versions-ci", VERIFIER, missing),
            ("malformed", "success", b"malformed-verifier-marker", invalid),
            ("ln out of bounds", "success", VERIFIER.replace(b"ln=14", b"ln=17"), invalid),
            ("wrong r", "success", VERIFIER.replace(b"r=8", b"r=7"), invalid),
            ("p out of bounds", "success", VERIFIER.replace(b"p=5", b"p=9"), invalid),
            ("trailing newline", "success", VERIFIER + b"\n", invalid),
            ("noncanonical base64", "success", VERIFIER[:-1] + b"x", invalid),
        )
        for case, outcome, value, message in cases:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as temporary:
                double = LifecycleDouble(temporary)
                double.prime("namespace", "pvc", "postgres-secret", "signing-secret", "release", "preview-secret")
                result = double.run("preview-deploy.sh", verifier=value, VERIFIER_STORE_RESULT=outcome)
                calls = double.calls()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIsNone(double.stored_verifier())
                self.assertEqual(result.stderr.count("::warning::"), 1)
                self.assertIn(f"::warning::{message}", result.stderr)
                self.assertNotIn(value.rstrip().decode(), calls + result.stdout + result.stderr)
                self.assertEqual(calls.count("replace -f "), 1)
                self.assertEqual(calls.count("rollout restart deployment/api"), 1)
                self.assertLess(calls.index("replace -f "), calls.index("helm upgrade --install"))
                self.assertIn("smoke timeout=60", calls)

    def test_other_store_read_failures_warn_without_changing_the_secret(self):
        for outcome in ("permission", "transport", "other-not-found", "nonstandard-exit"):
            with self.subTest(outcome=outcome), tempfile.TemporaryDirectory() as temporary:
                double = LifecycleDouble(temporary)
                installed = double.run("preview-deploy.sh")
                self.assertEqual(installed.returncode, 0, installed.stderr)
                double.log.unlink()
                result = double.run("preview-deploy.sh", VERIFIER_STORE_RESULT=outcome)
                calls = double.calls()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(double.stored_verifier(), VERIFIER)
                self.assertEqual(result.stderr.count("::warning::"), 1)
                self.assertIn("::warning::Could not read mkc-preview-sign-in-password", result.stderr)
                self.assertNotIn("create -f ", calls)
                self.assertNotIn("replace -f ", calls)
                self.assertNotIn("rollout restart", calls)
                self.assertIn("smoke timeout=60", calls)

    def test_each_post_change_failure_rolls_back_a_previous_revision(self):
        cases = (
            ({"HELM_UPGRADE_STATUS": "7"}, "Preview Helm deployment failed."),
            ({"CERTIFICATE_STATUS": "6"}, "Preview catalogue certificate"),
            ({"SMOKE_STATUS": "5"}, "Preview smoke checks failed."),
        )
        for overrides, diagnostic in cases:
            with self.subTest(overrides=overrides), tempfile.TemporaryDirectory() as temporary:
                double = LifecycleDouble(temporary)
                double.prime("namespace", "pvc", "postgres-secret", "signing-secret", "release")
                result = double.run("preview-deploy.sh", **overrides)
                calls = double.calls()
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("helm rollback mokly-cloud 7", calls)
            self.assertIn(diagnostic, result.stderr)

    def test_first_install_failure_never_rolls_back(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            result = double.run("preview-deploy.sh", CERTIFICATE_STATUS="4")
            calls = double.calls()
        self.assertEqual(result.returncode, 4)
        self.assertNotIn("helm rollback", calls)
        self.assertIn("First-install resources were retained", result.stderr)

    def test_dns_or_iam_failure_stops_before_helm_without_rollback(self):
        for override, stopped_call in (
            ({"FAIL_DNS_UPSERT": "2"}, "lifecycle iam-upsert"),
            ({"FAIL_IAM_UPSERT": "3"}, "helm upgrade"),
        ):
            with self.subTest(override=override), tempfile.TemporaryDirectory() as temporary:
                double = LifecycleDouble(temporary)
                result = double.run("preview-deploy.sh", **override)
                calls = double.calls()
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn(stopped_call, calls)
            self.assertNotIn("helm rollback", calls)

    def test_rollback_failure_is_reported_without_replacing_original_status(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            double.prime("namespace", "pvc", "postgres-secret", "signing-secret", "release")
            result = double.run(
                "preview-deploy.sh", HELM_UPGRADE_STATUS="7", HELM_ROLLBACK_STATUS="9"
            )
        self.assertEqual(result.returncode, 7)
        self.assertIn("rollback to revision 7 also failed with status 9", result.stderr)


class DestroyShellTests(unittest.TestCase):
    def test_destroy_and_retry_are_idempotent_without_deploy_only_inputs(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            double.prime(
                "namespace", "pvc", "postgres-secret", "signing-secret",
                "release", "dns", "iam", "objects",
            )
            first = double.run("preview-destroy.sh", deploy=False)
            second = double.run("preview-destroy.sh", deploy=False)
            calls = double.calls()
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertNotIn("platform-ready", calls)
        self.assertEqual(calls.count("helm uninstall"), 2)
        self.assertEqual(calls.count("lifecycle iam-remove"), 2)
        self.assertEqual(calls.count("lifecycle objects-delete"), 2)
        self.assertEqual(calls.count("lifecycle dns-delete"), 2)
        self.assertIn("--wait=true --timeout=900s", calls)

    def test_uninstall_failure_still_deletes_namespace_and_cleans_externals(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            double.prime("namespace", "release", "dns", "iam", "objects")
            result = double.run("preview-destroy.sh", deploy=False, HELM_UNINSTALL_STATUS="3")
            calls = double.calls()
        self.assertEqual(result.returncode, 1)
        self.assertIn("delete namespace mkc-preview-pr-42", calls)
        self.assertIn("lifecycle iam-remove", calls)
        self.assertIn("lifecycle dns-delete", calls)

    def test_namespace_failure_stops_before_every_external_cleanup(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            double.prime("namespace", "release", "dns", "iam", "objects")
            result = double.run("preview-destroy.sh", deploy=False, NAMESPACE_DELETE_STATUS="8")
            calls = double.calls()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("external preview cleanup was not started", result.stderr)
        self.assertNotIn("lifecycle iam-remove", calls)
        self.assertNotIn("lifecycle objects-delete", calls)
        self.assertNotIn("lifecycle dns-delete", calls)

    def test_external_failures_are_all_attempted_and_accumulated(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            double.prime("namespace", "release", "dns", "iam", "objects")
            result = double.run(
                "preview-destroy.sh",
                deploy=False,
                FAIL_IAM_REMOVE="2",
                FAIL_OBJECTS_DELETE="3",
                FAIL_DNS_DELETE="4",
            )
            calls = double.calls()
        self.assertEqual(result.returncode, 1)
        self.assertIn("lifecycle iam-remove", calls)
        self.assertIn("lifecycle objects-delete", calls)
        self.assertIn("lifecycle dns-delete", calls)
        self.assertIn("completed with errors", result.stderr)

    def test_dns_token_failure_does_not_skip_earlier_external_cleanup(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = LifecycleDouble(temporary)
            double.prime("namespace", "release", "dns", "iam", "objects")
            result = double.run("preview-destroy.sh", deploy=False, DNS_TOKEN_STATUS="5")
            calls = double.calls()
        self.assertEqual(result.returncode, 1)
        self.assertIn("lifecycle iam-remove", calls)
        self.assertIn("lifecycle objects-delete", calls)
        self.assertNotIn("lifecycle dns-delete", calls)


if __name__ == "__main__":
    unittest.main()
