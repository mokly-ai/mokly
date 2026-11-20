"""Shared preview-platform installation, readiness and workflow contracts."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from preview_platform_support import FIXTURES, PlatformDouble
from support import ROOT, load

helper = load("preview-platform-helper")


class PreviewPlatformTests(unittest.TestCase):
    def test_every_input_is_rejected_before_provider_calls(self):
        invalid = (
            {"MKC_REGION": "us-central"},
            {"MKC_PREVIEW_INGRESS_IP": "2001:db8::1"},
            {"MKC_PREVIEW_BLOBS_BUCKET": "another-bucket"},
            {"MKC_CATALOGUE_CLOUDFLARE_ZONE_ID": "A" * 32},
            {"MKC_DOMAIN": "app.example.com", "MKC_CATALOGUE_BASE_DOMAIN": "catalogue.example.com"},
            {"MKC_DOMAIN": "not_a_domain"},
        )
        for script in ("preview-platform.sh", "preview-platform-ready.sh"):
            for values in invalid:
                with self.subTest(script=script, values=values), tempfile.TemporaryDirectory() as temporary:
                    double = PlatformDouble(temporary)
                    result = double.run(script, **values)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertEqual(double.calls(), "")

    def test_scripts_reject_positional_arguments_before_provider_calls(self):
        for script in ("preview-platform.sh", "preview-platform-ready.sh"):
            with self.subTest(script=script), tempfile.TemporaryDirectory() as temporary:
                double = PlatformDouble(temporary)
                result = double.run(script, arguments=("unexpected",))
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("takes no arguments", result.stderr)
                self.assertEqual(double.calls(), "")

    def test_private_suffix_registrable_domains_are_distinct(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            environment = double.environment(
                MKC_DOMAIN="app.github.io",
                MKC_CATALOGUE_BASE_DOMAIN="catalogue.github.io",
            )
            result = subprocess.run(
                ["python3", "infra/scripts/preview-platform-helper.py", "validate-inputs"],
                cwd=ROOT,
                env=environment,
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            environment.update(
                MKC_DOMAIN="app.owner.github.io",
                MKC_CATALOGUE_BASE_DOMAIN="catalogue.owner.github.io",
            )
            result = subprocess.run(
                ["python3", "infra/scripts/preview-platform-helper.py", "validate-inputs"],
                cwd=ROOT,
                env=environment,
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertNotEqual(result.returncode, 0)

    def test_install_rejects_wrong_sans_expiry_and_key_mismatch(self):
        cases = (
            (
                {"TLS_CERT_FIXTURE": "tls-wrong-sans-cert.pem"},
                "Preview platform validation failed: certificate SANs do not match the preview wildcard hosts",
            ),
            (
                {"TLS_CERT_FIXTURE": "tls-expired-cert.pem"},
                "Preview TLS certificate is expired or expires within 24 hours",
            ),
            ({"TLS_KEY_FIXTURE": "tls-mismatched-key.pem"}, "Preview TLS key and certificate do not match"),
        )
        for variables, diagnostic in cases:
            with self.subTest(variables=variables), tempfile.TemporaryDirectory() as temporary:
                double = PlatformDouble(temporary)
                result = double.run(**variables)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(diagnostic, result.stderr + result.stdout)
                self.assertEqual(
                    result.stderr,
                    (FIXTURES / "gcloud-get-credentials.stderr.txt").read_text() + diagnostic + "\n",
                )
                self.assertNotIn("helm upgrade", double.calls())

    def test_denied_cluster_authorization_stops_before_install(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            denied = "delete clusterissuers.cert-manager.io/mkc-preview-letsencrypt"
            result = double.run(DENY_AUTH=denied)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("ClusterIssuer/mkc-preview-letsencrypt", result.stderr)
            calls = double.calls()
            self.assertNotIn("helm upgrade", calls)
            self.assertNotIn("secrets versions access", calls)

    def test_pending_service_becomes_ready_and_secrets_remain_private(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            result = double.run(SERVICE_MODE="pending_then_ready")
            self.assertEqual(result.returncode, 0, result.stderr)
            calls = double.calls()
            self.assertEqual(calls.count("get service ingress-nginx-controller"), 2)
            self.assertIn("sleep 5", calls)
            self.assertEqual(calls.count("temporary-modes 700 600"), 3)
            self.assertNotIn("fixture-catalogue-token", calls + result.stdout + result.stderr)
            expected = helper.cluster_inventory(
                (
                    FIXTURES / "helm-cert-manager-cluster-resources.yaml",
                    FIXTURES / "helm-ingress-nginx-cluster-resources.yaml",
                    ROOT / "infra/helm/platform/cluster-issuer.yaml",
                )
            )
            for kind, name, _resource in expected:
                self.assertIn(f"{kind}/{name}", result.stdout)

    def test_idempotent_install_uses_upserts_and_pinned_upgrades(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            first = double.run()
            second = double.run()
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(second.returncode, 0, second.stderr)
            calls = double.calls()
            self.assertEqual(calls.count("helm upgrade --install"), 4)
            self.assertGreaterEqual(calls.count("kubectl --kubeconfig"), 2)
            self.assertIn("--dry-run=client -o json", calls)
            self.assertIn("--version v1.21.2", calls)
            self.assertIn("--version 4.15.1", calls)
            self.assertIn("--all-namespaces --quiet", calls)

    def test_wrong_load_balancer_ip_has_exact_readiness_diagnostic(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            result = double.run("preview-platform-ready.sh", SERVICE_MODE="wrong")
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(
                result.stderr,
                "Preview platform is not ready; run deploy.yml's preview-platform job. "
                "Failing resource: Service/ingress-nginx-controller.\n",
            )
            calls = double.calls()
            self.assertNotIn("secrets versions access", calls)
            self.assertNotIn("helm ", calls)

    def test_installer_rejects_a_wrong_load_balancer_ip_without_waiting(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            result = double.run(SERVICE_MODE="wrong")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Service/ingress-nginx-controller", result.stderr)
            self.assertNotIn("sleep 5", double.calls())

    def test_missing_namespace_names_the_failing_resource(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            result = double.run("preview-platform-ready.sh", MISSING_NAMESPACE="true")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Namespace/mkc-preview-system", result.stderr)

    def test_workflow_orders_and_requires_the_platform_job(self):
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text()
        self.assertLess(workflow.index("  origin-router:"), workflow.index("  preview-platform:"))
        self.assertLess(workflow.index("  preview-platform:"), workflow.index("  plan-main-preview:"))
        self.assertIn("needs: [publish, origin-router, preview-platform]", workflow)
        self.assertIn("bash infra/scripts/preview-platform.sh", workflow)
        self.assertIn("bash infra/scripts/preview-platform-ready.sh", workflow)
        self.assertIn("MKC_PREVIEW_INGRESS_IP: ${{ vars.MKC_PREVIEW_INGRESS_IP }}", workflow)
        self.assertIn("MKC_PREVIEW_BLOBS_BUCKET: ${{ vars.MKC_PREVIEW_BLOBS_BUCKET }}", workflow)
        required = workflow.split("  required:\n", 1)[1]
        self.assertIn("preview-platform", required)
        self.assertIn("PLATFORM_RESULT", required)

    def test_partial_credential_gate_configuration_fails(self):
        cases = (
            ({}, 0, "false"),
            ({"GCP_WORKLOAD_IDENTITY_PROVIDER": "pool"}, 1, None),
            ({"MKC_PREVIEW_INGRESS_IP": "192.0.2.42"}, 1, None),
            (
                {
                    "GCP_WORKLOAD_IDENTITY_PROVIDER": "pool",
                    "GCP_SERVICE_ACCOUNT": "account",
                    "MKC_PREVIEW_INGRESS_IP": "192.0.2.42",
                    "MKC_PREVIEW_BLOBS_BUCKET": "mokly-508518-preview-blobs",
                },
                0,
                "true",
            ),
        )
        for values, status, enabled in cases:
            with self.subTest(values=values), tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary) / "output"
                environment = {"PATH": os.environ["PATH"], "GITHUB_OUTPUT": str(output), **values}
                result = subprocess.run(
                    ["bash", "infra/scripts/credential-gate.sh"],
                    cwd=ROOT,
                    env=environment,
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                self.assertEqual(result.returncode, status, result.stderr)
                if enabled is not None:
                    self.assertEqual(output.read_text(), f"enabled={enabled}\n")


class PreviewPlatformChartTests(unittest.TestCase):
    def chart(self, name, repository, version):
        cache = ROOT / ".context/preview-platform-chart-test"
        cache.mkdir(parents=True, exist_ok=True)
        path = cache / f"{name}-{version}.tgz"
        if not path.exists():
            result = subprocess.run(
                ["helm", "pull", name, "--repo", repository, "--version", version, "--destination", str(cache)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode != 0:
                self.skipTest(f"chart network unavailable; offline render skipped aloud: {result.stderr.strip()}")
        return path

    def test_pinned_charts_render_offline_with_platform_values(self):
        pins = json.loads((ROOT / "infra/toolchains.json").read_text())
        cert = self.chart("cert-manager", "https://charts.jetstack.io", pins["cert_manager_chart"])
        ingress = self.chart(
            "ingress-nginx", "https://kubernetes.github.io/ingress-nginx", pins["ingress_nginx_chart"]
        )
        cidrs = helper.cloudflare_cidrs(ROOT / "infra/helm/mokly-cloud/values.yaml")
        with tempfile.TemporaryDirectory() as temporary:
            cert_render = Path(temporary) / "cert-manager.yaml"
            ingress_render = Path(temporary) / "ingress-nginx.yaml"
            commands = (
                (
                    cert_render,
                    ["helm", "template", "cert-manager", str(cert), "--namespace", "mkc-preview-system", "-f", "infra/helm/platform/cert-manager-values.yaml"],
                ),
                (
                    ingress_render,
                    [
                        "helm", "template", "ingress-nginx", str(ingress), "--namespace", "mkc-preview-system",
                        "-f", "infra/helm/platform/ingress-nginx-values.yaml",
                        "--set-string", "controller.service.loadBalancerIP=192.0.2.42",
                        "--set-string", "controller.config.proxy-real-ip-cidr=" + cidrs.replace(",", r"\,"),
                    ],
                ),
            )
            for output, command in commands:
                result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
                self.assertEqual(result.returncode, 0, result.stderr)
                output.write_text(result.stdout)
            inventory = helper.cluster_inventory((cert_render, ingress_render))
            cert_text = cert_render.read_text()
            ingress_text = ingress_render.read_text()
        expected = helper.cluster_inventory(
            (
                FIXTURES / "helm-cert-manager-cluster-resources.yaml",
                FIXTURES / "helm-ingress-nginx-cluster-resources.yaml",
            )
        )
        self.assertEqual(inventory, expected)
        names = {f"{kind}/{name}" for kind, name, _resource in inventory}
        self.assertIn("CustomResourceDefinition/certificates.cert-manager.io", names)
        self.assertIn("ValidatingWebhookConfiguration/cert-manager-webhook", names)
        self.assertIn("IngressClass/mkc-preview", names)
        self.assertIn("loadBalancerIP: 192.0.2.42", ingress_text)
        self.assertIn("externalTrafficPolicy: Local", ingress_text)
        self.assertIn('cloud.google.com/l4-rbs: "enabled"', ingress_text)
        self.assertIn('proxy-real-ip-cidr: "' + cidrs + '"', ingress_text)
        self.assertIn("controller: mokly.ai/preview-ingress-nginx", ingress_text)
        self.assertIn("--cluster-resource-namespace=mkc-preview-system", cert_text)
        self.assertGreaterEqual(cert_text.count("cpu: 250m"), 3)
        self.assertGreaterEqual(cert_text.count("memory: 512Mi"), 3)
        self.assertGreaterEqual(cert_text.count("memory: 1Gi"), 3)

    def test_cluster_issuer_template_is_the_exact_contract(self):
        manifest = (ROOT / "infra/helm/platform/cluster-issuer.yaml").read_text()
        self.assertIn("server: https://acme-v02.api.letsencrypt.org/directory", manifest)
        self.assertIn("name: mkc-preview-letsencrypt-account", manifest)
        self.assertIn("name: catalogue-dns-token", manifest)
        self.assertIn("key: api-token", manifest)
        self.assertNotIn("email:", manifest)


if __name__ == "__main__":
    unittest.main()
