"""Shell control-flow integration with synthetic adapters, not reconciliation recordings."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from support import ROOT


class RolloutTests(unittest.TestCase):
    def test_stable_rollout_does_not_dispatch_to_the_pr_lifecycle(self):
        script = (ROOT / "infra/scripts/rollout.sh").read_text()
        self.assertNotIn("preview-deploy", script)
        self.assertNotIn("preview-pr-*", script)
        self.assertIn("source infra/scripts/environment.sh", script)

    def test_smoke_failure_rolls_back_previous_revision_and_exits_one(self):
        self.check_rollout(previous="7", budget="60")

    def test_first_install_allows_ingress_provisioning_without_a_rollback(self):
        self.check_rollout(previous="", budget="900")

    def test_explicit_reset_quiesces_workloads_and_selects_database_hooks(self):
        self.check_rollout(previous="7", budget="60", reset=True)

    def test_reset_preparation_failure_restores_release_before_data_deletion(self):
        self.check_rollout(previous="7", budget="60", reset=True, reset_failure=True)

    def test_database_api_failure_leaves_workloads_stopped(self):
        self.check_rollout(previous="7", budget="60", reset=True, database_failure=True)

    def test_database_reset_retry_recreates_a_missing_database(self):
        self.check_rollout(previous="7", budget="60", reset=True, database_exists=False)

    def test_reset_helm_failure_leaves_workloads_stopped(self):
        self.check_rollout(previous="7", budget="60", reset=True, helm_failure=True)

    def test_invalid_reset_is_rejected_before_provider_calls(self):
        result = subprocess.run(
            ["bash", "infra/scripts/rollout.sh", "main-preview"],
            cwd=ROOT,
            env={"PATH": os.environ["PATH"], "RESET_RELEASE": "TRUE"},
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("RESET_RELEASE must be true, false or unset", result.stderr)
        self.assertNotIn("Set MKC_REGION", result.stderr)

    def check_rollout(
        self,
        previous,
        budget,
        reset=False,
        reset_failure=False,
        database_failure=False,
        database_exists=True,
        helm_failure=False,
    ):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            log = directory / "calls"
            scripts = {
                "helm": """printf 'helm %s\\n' "$*" >> "$CALLS"
if [[ "$1" == list ]]; then
  if [[ -n "$PREVIOUS" ]]; then
    echo '[{"name":"mokly-cloud","namespace":"mkc-main-preview","revision":"7","updated":"2026-09-16 00:00:00 +0000 UTC","status":"deployed","chart":"mokly-cloud-0.1.0","app_version":"0.1.0"}]'
  else
    echo '[]'
  fi
fi
if [[ "$1" == upgrade && "${HELM_FAILURE:-false}" == true ]]; then exit 8; fi
""",
                "kubectl": """printf 'kubectl %s\\n' "$*" >> "$CALLS"
if [[ "$*" == *"apply -f -"* ]]; then cat >/dev/null; fi
if [[ "$*" == *"delete deployment api app catalogue"* && "${RESET_FAILURE:-false}" == true ]]; then exit 9; fi
""",
                "gcloud": """printf 'gcloud %s\\n' "$*" >> "$CALLS"
if [[ "$1 $2 $3" == "sql databases list" && "${DATABASE_EXISTS:-true}" == true ]]; then echo mokly; fi
if [[ "$1 $2 $3" == "sql databases delete" && "${DATABASE_FAILURE:-false}" == true ]]; then exit 10; fi
for argument in "$@"; do
  if [[ "$argument" == --out-file=* ]]; then echo synthetic > "${argument#--out-file=}"; fi
done
""",
                "openssl": """printf 'openssl %s\\n' "$*" >> "$CALLS"
""",
                "python3": f"""if [[ "$1" == infra/scripts/smoke.py ]]; then
  echo "smoke-failed timeout=$MKC_SMOKE_TIMEOUT_SECONDS desktop=$MKC_DESKTOP_CLIENT" >> "$CALLS"
  exit 1
fi
exec "{sys.executable}" "$@"
""",
            }
            for name, body in scripts.items():
                path = directory / name
                path.write_text("#!/usr/bin/env bash\nset -euo pipefail\n" + body)
                path.chmod(0o755)
            digest = "us-central1-docker.pkg.dev/mokly-508518/mokly/fixture@sha256:" + "a" * 64
            environment = dict(os.environ, PATH=str(directory) + ":" + os.environ["PATH"],
                CALLS=str(log), PREVIOUS=previous, MKC_DESKTOP_CLIENT="false", MKC_REVISION="a" * 40, MKC_REGION="us-central1",
                RESET_FAILURE="true" if reset_failure else "false",
                DATABASE_FAILURE="true" if database_failure else "false",
                DATABASE_EXISTS="true" if database_exists else "false",
                HELM_FAILURE="true" if helm_failure else "false",
                MKC_DOMAIN="example.invalid",
                MKC_CATALOGUE_BASE_DOMAIN="catalogues.invalid", MKC_INGRESS_IP="192.0.2.1",
                MKC_CATALOGUE_CLOUDFLARE_ZONE_ID="catalogue-test", MKC_NOTIFICATION_CHANNELS='["projects/mokly-508518/notificationChannels/123"]',
                MKC_CLOUDFLARE_ZONE_ID="test", MKC_POSTMARK_FROM="test@example.invalid",
                MKC_API_IMAGE=digest, MKC_APP_IMAGE=digest, MKC_CATALOGUE_IMAGE=digest,
                MKC_CATALOGUE_CONFIG='{"healthPath":"/_health"}')
            if reset:
                environment["RESET_RELEASE"] = "true"
            else:
                environment.pop("RESET_RELEASE", None)
            environment.pop("MKC_RELEASE_VALUES", None)
            result = subprocess.run(["bash", "infra/scripts/rollout.sh", "main-preview"],
                cwd=ROOT, env=environment, capture_output=True, text=True, timeout=20)
            self.assertEqual(result.returncode, 1, result.stderr)
            calls = log.read_text()
            self.assertIn("openssl x509", calls)
            self.assertIn("-checkhost app-origin-main-preview.example.invalid", calls)
            self.assertIn("-checkhost br-main.preview.api.example.invalid", calls)
            self.assertIn(
                "-checkhost probe.br-main.preview.catalogues.invalid", calls
            )
            if reset_failure:
                self.assertNotIn("smoke-failed", calls)
                self.assertNotIn("helm upgrade --install", calls)
                self.assertIn("helm rollback mokly-cloud 7", calls)
                self.assertIn("Database reset preparation failed", result.stderr)
                return
            if database_failure:
                self.assertNotIn("smoke-failed", calls)
                self.assertNotIn("helm upgrade --install", calls)
                self.assertNotIn("helm rollback", calls)
                self.assertIn("Database reset failed; workloads remain stopped", result.stderr)
                return
            if helm_failure:
                self.assertNotIn("smoke-failed", calls)
                self.assertIn("helm upgrade --install", calls)
                self.assertNotIn("helm rollback", calls)
                self.assertIn("workloads remain stopped", result.stderr)
                self.assertEqual(calls.count("delete deployment api app catalogue"), 2)
                return
            self.assertLess(calls.index("helm upgrade --install"), calls.index("smoke-failed"))
            self.assertIn("smoke-failed timeout=" + budget + " desktop=true", calls)
            if reset:
                for resource in (
                    "cronjob auth-prune publication-check-status billing-delivery-status "
                    "github-prune publication-maintenance",
                    "job mokly-cloud-migrate mokly-cloud-reset-database "
                    "mokly-cloud-grant-database",
                    "horizontalpodautoscaler api app catalogue",
                    "poddisruptionbudget api app catalogue",
                    "deployment api app catalogue",
                ):
                    expected = "kubectl --namespace mkc-main-preview delete " + resource
                    self.assertIn(expected, calls)
                    deletion = calls.index(expected)
                    self.assertLess(deletion, calls.index("helm upgrade --install"))
                    self.assertLess(deletion, calls.index("gcloud sql databases list"))
                upgrade = next(
                    line for line in calls.splitlines() if "helm upgrade --install" in line
                )
                self.assertIn("--set resetDatabase=true", upgrade)
                self.assertNotIn("--rollback-on-failure", upgrade)
                list_database = calls.index("gcloud sql databases list")
                create_database = calls.index("gcloud sql databases create mokly")
                if database_exists:
                    delete_database = calls.index("gcloud sql databases delete mokly")
                    self.assertLess(list_database, delete_database)
                    self.assertLess(delete_database, create_database)
                else:
                    self.assertNotIn("gcloud sql databases delete mokly", calls)
                    self.assertLess(list_database, create_database)
                self.assertLess(create_database, calls.index("helm upgrade --install"))
                self.assertIn(
                    "--impersonate-service-account=mkc-main-preview-reset@mokly-508518.iam.gserviceaccount.com",
                    calls,
                )
                self.assertEqual(calls.count("delete deployment api app catalogue"), 2)
                self.assertNotIn("rollout restart", calls)
                self.assertNotIn("helm rollback", calls)
            else:
                self.assertNotIn("delete deployment", calls)
                self.assertNotIn("resetDatabase=true", calls)
                self.assertNotIn("rollout restart", calls)
            if previous and not reset:
                self.assertLess(calls.index("smoke-failed"), calls.index("helm rollback mokly-cloud 7"))
                self.assertIn("--namespace mkc-main-preview --wait --wait-for-jobs --timeout 15m", calls)
            elif not reset:
                self.assertNotIn("helm rollback", calls)
            self.assertNotIn("helm template", calls)
            self.assertIn("Rollout smoke failed", result.stderr)
