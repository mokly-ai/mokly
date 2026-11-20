"""Readiness validates the cluster TLS bytes without changing shared resources."""

import base64
from pathlib import Path
import tempfile
import unittest

from preview_platform_support import FIXTURES, PlatformDouble


TLS_RESOURCE_DIAGNOSTIC = (
    "Preview platform is not ready; run deploy.yml's preview-platform job. "
    "Failing resource: Secret/preview-origin-tls.\n"
)


class PreviewPlatformReadinessTlsTests(unittest.TestCase):
    def assert_private_tls(self, double, result, certificate, key):
        files = double.tls_files()
        self.assertGreater(len(files), 0)
        for name, directory_mode, file_mode in files:
            self.assertEqual(directory_mode, "700")
            self.assertEqual(file_mode, "600")
            self.assertFalse(Path(name).exists())
            self.assertFalse(Path(name).parent.exists())
        exposed = double.calls() + result.stdout + result.stderr
        self.assertNotIn("-----BEGIN", exposed)
        for fixture in (certificate, key):
            material = (FIXTURES / fixture).read_bytes()
            self.assertNotIn(base64.b64encode(material).decode("ascii"), exposed)
            for line in material.decode("ascii").splitlines():
                self.assertNotIn(line, exposed)

    def assert_read_only(self, calls):
        for mutation in (" create ", " apply ", " label ", " delete ", "secrets versions access", "helm "):
            self.assertNotIn(mutation, calls)

    def test_readiness_requires_openssl_before_provider_calls(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            result = double.run("preview-platform-ready.sh", PATH=double.without_openssl())
            self.assertEqual(result.returncode, 1)
            self.assertEqual(
                result.stderr,
                "openssl is required to check preview platform readiness\n",
            )
            self.assertEqual(result.stdout, "")
            self.assertEqual(double.calls(), "")

    def test_readiness_accepts_matching_tls_with_private_storage_and_cleanup(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            double.observe_tls_files()
            result = double.run("preview-platform-ready.sh")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, "Preview platform ready at 192.0.2.42.\n")
            self.assertEqual(result.stderr, "")
            self.assert_private_tls(double, result, "tls-cert.pem", "tls-key.pem")
            self.assert_read_only(double.calls())

    def test_readiness_rejects_invalid_tls_and_removes_private_storage(self):
        cases = (
            ("tls-expired-cert.pem", "tls-key.pem"),
            ("tls-wrong-sans-cert.pem", "tls-key.pem"),
            ("tls-cert.pem", "tls-mismatched-key.pem"),
            ("tls-key.pem", "tls-key.pem"),
            ("tls-cert.pem", "tls-cert.pem"),
        )
        for certificate, key in cases:
            with self.subTest(certificate=certificate, key=key), tempfile.TemporaryDirectory() as temporary:
                double = PlatformDouble(temporary)
                double.observe_tls_files()
                secret = double.origin_tls_secret(certificate, key)
                result = double.run("preview-platform-ready.sh", TLS_SECRET_JSON=secret)
                self.assertEqual(result.returncode, 1, result.stdout)
                self.assertEqual(result.stderr, TLS_RESOURCE_DIAGNOSTIC)
                self.assertEqual(result.stdout, "")
                self.assert_private_tls(double, result, certificate, key)
                self.assert_read_only(double.calls())

    def test_installer_final_gate_rejects_invalid_cluster_tls(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            double.observe_tls_files()
            secret = double.origin_tls_secret(key="tls-mismatched-key.pem")
            result = double.run(TLS_SECRET_JSON=secret)
            self.assertEqual(result.returncode, 1, result.stdout)
            self.assertEqual(
                result.stderr,
                (FIXTURES / "gcloud-get-credentials.stderr.txt").read_text()
                + "Preview platform installation failed readiness at Secret/preview-origin-tls\n",
            )
            self.assertEqual(result.stdout, "")
            self.assert_private_tls(double, result, "tls-cert.pem", "tls-mismatched-key.pem")
            self.assertIn("helm upgrade --install", double.calls())
            provider_calls = [
                line for line in double.calls().splitlines()
                if line.startswith(("kubectl ", "gcloud ", "helm "))
            ]
            self.assertIn("get secret preview-origin-tls -o json", provider_calls[-1])


if __name__ == "__main__":
    unittest.main()
