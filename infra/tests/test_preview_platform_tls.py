"""Preview installer diagnostics distinguish missing tools and invalid certificates."""

import tempfile
import unittest

from preview_platform_support import FIXTURES, PlatformDouble


class PreviewPlatformTlsTests(unittest.TestCase):
    def test_missing_openssl_stops_before_provider_calls(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            result = double.run(PATH=double.without_openssl())
            self.assertEqual(result.returncode, 1)
            self.assertEqual(
                result.stderr,
                "openssl is required to check the preview TLS certificate\n",
            )
            self.assertEqual(result.stdout, "")
            self.assertEqual(double.calls(), "")

    def test_non_certificate_input_has_a_distinct_private_diagnostic(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            result = double.run(TLS_CERT_FIXTURE="tls-key.pem")
            self.assertEqual(result.returncode, 1)
            self.assertEqual(
                result.stderr,
                (FIXTURES / "gcloud-get-credentials.stderr.txt").read_text()
                + "Preview TLS certificate cannot be read\n",
            )
            self.assertEqual(result.stdout, "")
            self.assertNotIn("helm upgrade", double.calls())

    def test_non_key_input_has_a_distinct_private_diagnostic(self):
        with tempfile.TemporaryDirectory() as temporary:
            double = PlatformDouble(temporary)
            result = double.run(TLS_KEY_FIXTURE="tls-cert.pem")
            self.assertEqual(result.returncode, 1)
            self.assertEqual(
                result.stderr,
                (FIXTURES / "gcloud-get-credentials.stderr.txt").read_text()
                + "Preview TLS key cannot be read\n",
            )
            self.assertEqual(result.stdout, "")
            self.assertNotIn("helm upgrade", double.calls())
            self.assertNotIn("create secret", double.calls())


if __name__ == "__main__":
    unittest.main()
