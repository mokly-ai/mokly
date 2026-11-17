"""Pure PR policy, destructive guard and credential-gate regression coverage."""

import copy
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from support import ROOT, load

events = load("preview-event")
render = load("render-values")


class LifecycleTests(unittest.TestCase):
    def event(self, action="labeled"):
        return {"action": action, "number": 42, "label": {"name": "preview"},
                "repository": {"full_name": "mokly-ai/mokly-cloud", "private": True},
                "pull_request": {"state": "open", "labels": [{"name": "preview"}],
                    "head": {"sha": "a" * 40, "repo": {"full_name": "mokly-ai/mokly-cloud"}}}}

    def test_create_update_reopen_cleanup_and_forks(self):
        for action in ("labeled", "synchronize", "reopened"):
            self.assertEqual(events.decision(self.event(action))["action"], "deploy")
        for action in ("unlabeled", "closed"):
            event = self.event(action)
            event["pull_request"]["labels"] = []
            self.assertEqual(events.decision(event)["action"], "destroy")
        event = self.event()
        event["pull_request"]["head"]["repo"]["full_name"] = "fork/repo"
        self.assertEqual(events.decision(event)["action"], "skip")
        event["pull_request"]["head"]["repo"] = None
        self.assertEqual(events.decision(event)["action"], "skip")

    def test_unlabelled_push_and_unrelated_label_skip(self):
        event = self.event("synchronize")
        event["pull_request"]["labels"] = []
        self.assertEqual(events.decision(event)["action"], "skip")
        event = self.event()
        event["label"]["name"] = "bug"
        self.assertEqual(events.decision(event)["action"], "skip")

    def test_metadata_cannot_inject_shell_or_stable_names(self):
        for number in ("production", "0", "-1", "1; echo bad", "1\nenabled=true"):
            with self.subTest(number=number), self.assertRaises(ValueError):
                events.decision(dict(self.event(), number=number))
        event = copy.deepcopy(self.event())
        event["pull_request"]["head"]["sha"] = "$(echo bad)"
        with self.assertRaises(ValueError):
            events.decision(event)

    def test_repository_privacy_is_validated_and_exposed(self):
        for private, expected in ((True, "true"), (False, "false")):
            event = self.event()
            event["repository"]["private"] = private
            self.assertEqual(events.decision(event)["repository_private"], expected)
        for invalid in (None, "true", 1):
            event = self.event()
            event["repository"]["private"] = invalid
            with self.subTest(invalid=invalid), self.assertRaisesRegex(ValueError, "privacy"):
                events.decision(event)

    def test_preview_scripts_reject_stable_names_before_provider_calls(self):
        for script in ("preview-deploy.sh", "preview-destroy.sh"):
            for name in ("production", "main-preview", "preview-pr-0", "preview-pr-1;true", ""):
                with self.subTest(script=script, name=name):
                    result = subprocess.run(
                        ["bash", f"infra/scripts/{script}", name],
                        cwd=ROOT,
                        env={"PATH": os.environ["PATH"]},
                        capture_output=True,
                        text=True,
                        timeout=10,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("preview-pr-N", result.stderr)

    def test_preview_destroy_has_no_readiness_or_release_input_dependency(self):
        script = (ROOT / "infra/scripts/preview-destroy.sh").read_text()
        self.assertNotIn("preview-platform-ready.sh", script)
        self.assertNotIn("MKC_REVISION", script)
        self.assertNotIn("MKC_API_IMAGE", script)
        self.assertNotIn("MKC_CATALOGUE_IMAGE", script)
        self.assertNotIn("MKC_APP_IMAGE", script)
        self.assertIn("--timeout=900s", script)

    def test_credential_gate_reports_missing_names(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "outputs"
            for provider, account, expected, status in (
                ("", "", "false", 0),
                ("pool", "", None, 1),
                ("pool", "account", "true", 0),
            ):
                output.write_text("")
                result = subprocess.run(["bash", "infra/scripts/credential-gate.sh"], cwd=ROOT,
                    env=dict(os.environ, GCP_WORKLOAD_IDENTITY_PROVIDER=provider, GCP_SERVICE_ACCOUNT=account,
                             GITHUB_OUTPUT=str(output)), capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, status, result.stderr)
                if expected is not None:
                    self.assertEqual(output.read_text(), f"enabled={expected}\n")
                    self.assertEqual("SKIP" in result.stdout, expected == "false")

    def test_ci_apply_accepts_only_the_stable_main_deploy_workflow(self):
        inputs = dict(
            os.environ,
            GITHUB_ACTIONS="true",
            GITHUB_EVENT_NAME="push",
            GITHUB_REF="refs/heads/main",
            GITHUB_WORKFLOW_REF="mokly-ai/mokly-cloud/.github/workflows/deploy.yml@refs/heads/main",
            MKC_REGION="us-central1",
            MKC_DOMAIN="example.com",
            MKC_CLOUDFLARE_ZONE_ID="a" * 32,
            MKC_CATALOGUE_BASE_DOMAIN="catalogues.net",
            MKC_CATALOGUE_CLOUDFLARE_ZONE_ID="b" * 32,
            MKC_NOTIFICATION_CHANNELS='["projects/mokly-508518/notificationChannels/123"]',
            MKC_STATE_BUCKET="state-bucket",
        )
        cases = [
            ("main-preview", "pull_request", "refs/heads/main", inputs["GITHUB_WORKFLOW_REF"], "trusted deploy workflow"),
            ("production", "push", "refs/heads/feature", inputs["GITHUB_WORKFLOW_REF"], "trusted deploy workflow"),
            ("production", "push", "refs/heads/main", "mokly-ai/mokly-cloud/.github/workflows/ci.yml@refs/heads/main", "trusted deploy workflow"),
            ("preview-pr-42", "push", "refs/heads/main", inputs["GITHUB_WORKFLOW_REF"], "only production or main-preview"),
        ]
        for environment, event, ref, workflow, message in cases:
            with self.subTest(environment=environment, event=event, ref=ref, workflow=workflow):
                result = subprocess.run(
                    ["bash", "infra/scripts/terraform-environment.sh", environment, "apply"],
                    cwd=ROOT,
                    env=dict(inputs, GITHUB_EVENT_NAME=event, GITHUB_REF=ref, GITHUB_WORKFLOW_REF=workflow),
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr)

        with tempfile.TemporaryDirectory() as temporary:
            gcloud = Path(temporary) / "gcloud"
            gcloud.write_text("#!/usr/bin/env bash\nexit 23\n")
            gcloud.chmod(0o755)
            dispatch = subprocess.run(
                ["bash", "infra/scripts/terraform-environment.sh", "main-preview", "apply"],
                cwd=ROOT,
                env=dict(
                    inputs,
                    GITHUB_EVENT_NAME="workflow_dispatch",
                    PATH=temporary + ":" + os.environ["PATH"],
                ),
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(dispatch.returncode, 23, dispatch.stderr)
            self.assertNotIn("trusted deploy workflow", dispatch.stderr)

        for actions in ("true", "false"):
            for name in ("production", "main-preview"):
                with self.subTest(ci=actions, environment=name):
                    destroy = subprocess.run(
                        ["bash", "infra/scripts/terraform-environment.sh", name, "destroy-plan"],
                        cwd=ROOT, env=dict(inputs, GITHUB_ACTIONS=actions),
                        capture_output=True, text=True, timeout=10,
                    )
                    self.assertNotEqual(destroy.returncode, 0)
                    self.assertIn("Unknown plan action", destroy.stderr)

    def test_stable_entrypoints_reject_pr_names_before_reading_cloud_inputs(self):
        for script in ("environment.sh", "terraform-environment.sh", "rollout.sh"):
            for name in ("preview-pr-42", "preview-pr-0", "preview-pr-01", "release-preview"):
                with self.subTest(script=script, environment=name):
                    result = subprocess.run(
                        ["bash", f"infra/scripts/{script}", name, "plan"],
                        cwd=ROOT, env={"PATH": os.environ["PATH"]},
                        capture_output=True, text=True, timeout=10,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("only production or main-preview", result.stderr)

    def test_render_requires_real_images_and_catalogue_contract(self):
        values = dict(MKC_DOMAIN="example.invalid", MKC_REGION="us-central1",
                      MKC_CATALOGUE_BASE_DOMAIN="catalogues.invalid", MKC_INGRESS_IP="192.0.2.1", MKC_REVISION="a" * 40,
                      MKC_POSTMARK_FROM="mail@example.invalid")
        with self.assertRaisesRegex(ValueError, "built Artifact Registry digest"):
            render.values("main-preview", values)
        image = "us-central1-docker.pkg.dev/mokly-508518/mokly/api@sha256:" + "a" * 64
        values.update(MKC_API_IMAGE=image, MKC_APP_IMAGE=image, MKC_CATALOGUE_IMAGE=image)
        values["MKC_CATALOGUE_CONFIG"] = '{"healthPath":"/unimplemented"}'
        with self.assertRaisesRegex(ValueError, "healthPath"):
            render.values("main-preview", values)
        values["MKC_CATALOGUE_CONFIG"] = '{"healthPath":"/_health"}'
        values.update(MKC_PREVIEW_INGRESS_IP="192.0.2.42",
                      MKC_PREVIEW_BLOBS_BUCKET="mokly-508518-preview-blobs")
        self.assertEqual(render.values("preview-pr-42", values)["prNumber"], 42)
