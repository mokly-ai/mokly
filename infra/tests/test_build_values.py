"""Build settings delivery, group validation and API-only secret loading."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from support import ROOT, load


RENDER = load("render-values")
GITHUB = {"enabled": True, "appId": "123", "clientId": "Iv1.fixture", "appSlug": "mokly-test"}
BUILDS = {"enabled": True, "template": "released-template", "deploymentId": "main-preview"}


class BuildValuesTests(unittest.TestCase):
    def inputs(self, builds=None, github=GITHUB):
        config = {"github": github}
        if builds is not None:
            config["builds"] = builds
        digest = "us-central1-docker.pkg.dev/mokly-508518/mokly/fixture@sha256:" + "a" * 64
        return {
            "MKC_DOMAIN": "example.invalid", "MKC_CATALOGUE_BASE_DOMAIN": "catalogues.invalid",
            "MKC_REVISION": "a" * 40, "MKC_REGION": "us-central1", "MKC_INGRESS_IP": "192.0.2.1",
            "MKC_PREVIEW_INGRESS_IP": "192.0.2.1", "MKC_PREVIEW_BLOBS_BUCKET": "mokly-508518-preview-blobs",
            "MKC_API_IMAGE": digest, "MKC_APP_IMAGE": digest, "MKC_CATALOGUE_IMAGE": digest,
            "MKC_APP_CONFIG": json.dumps(config),
        }

    def test_absent_or_disabled_group_renders_no_build_values(self):
        for group in (None, {"enabled": False}):
            self.assertEqual(RENDER.values("production", self.inputs(group))["builds"], {"enabled": False})

    def test_complete_stable_group_preserves_reviewed_nonsecret_values(self):
        group = dict(BUILDS, perProcess=16, deniedDestinations=["203.0.113.19/24", "2001:db8::1"])
        for environment in ("production", "main-preview"):
            result = RENDER.values(environment, self.inputs(group))
            self.assertEqual(result["builds"], group)
            self.assertNotIn("builds", result["app"])
        self.assertEqual(RENDER.values("production", self.inputs(BUILDS))["builds"], BUILDS)

    def test_every_partial_group_and_disabled_extras_are_rejected(self):
        for group in ({}, {"enabled": "true"}, {"enabled": True},
                      {"enabled": True, "template": "template"},
                      {"enabled": True, "deploymentId": "production"},
                      {"enabled": False, "template": "template"},
                      {"enabled": False, "perProcess": 4},
                      dict(BUILDS, apiKey="secret")):
            with self.subTest(group=group), self.assertRaises(ValueError):
                RENDER.values("production", self.inputs(group))

    def test_github_is_required_and_every_pr_rejects_builds(self):
        with self.assertRaisesRegex(ValueError, "require GitHub"):
            RENDER.values("production", self.inputs(BUILDS, {"enabled": False}))
        with self.assertRaisesRegex(ValueError, "PR previews cannot enable builds"):
            RENDER.values("preview-pr-42", self.inputs(BUILDS, {"enabled": False}))
        result = RENDER.values("preview-pr-42", self.inputs(None, {"enabled": False}))
        self.assertEqual(result["builds"], {"enabled": False})

    def test_template_deployment_and_concurrency_match_runtime_bounds(self):
        for template in ("", " template", "template ", "template\n", 1, None):
            with self.subTest(template=template), self.assertRaises(ValueError):
                RENDER.values("production", self.inputs(dict(BUILDS, template=template)))
        for deployment in ("", "UPPER", "space here", "under_score", "a/b", "a" * 64, 1):
            with self.subTest(deployment=deployment), self.assertRaises(ValueError):
                RENDER.values("production", self.inputs(dict(BUILDS, deploymentId=deployment)))
        for ceiling in (0, 17, -1, 1.5, "4", True, None):
            with self.subTest(ceiling=ceiling), self.assertRaises(ValueError):
                RENDER.values("production", self.inputs(dict(BUILDS, perProcess=ceiling)))
        for ceiling in (1, 4, 16):
            self.assertEqual(RENDER.values("production", self.inputs(dict(BUILDS, perProcess=ceiling)))
                             ["builds"]["perProcess"], ceiling)
        for deployment in ("-", "a" * 63):
            self.assertEqual(RENDER.values("production", self.inputs(dict(BUILDS, deploymentId=deployment)))
                             ["builds"]["deploymentId"], deployment)

    def test_denied_destinations_accept_ips_and_cidrs_with_a_32_entry_bound(self):
        for entries in ([], ["203.0.113.1", "203.0.113.19/24", "::1", "2001:db8::/32"],
                        ["::ffff:192.0.2.1", "2001:DB8:1:2:3:4:5:6/64"], ["10.0.0.1"] * 32):
            self.assertEqual(RENDER.values("production", self.inputs(dict(BUILDS, deniedDestinations=entries)))
                             ["builds"]["deniedDestinations"], entries)
        for entries in ("10.0.0.1", ["10.0.0.1"] * 33, [""], ["example.invalid"],
                        ["10.0.0.1/33"], ["2001:db8::/129"], ["1::2::3"], ["999.0.0.1"],
                        ["fe80::1%eth0"], ["fe80::1%eth0/64"], ["10.0.0.0/255.255.255.0"],
                        ["10.0.0.0/0.0.0.255"], [1], [None]):
            with self.subTest(entries=entries), self.assertRaises(ValueError):
                RENDER.values("production", self.inputs(dict(BUILDS, deniedDestinations=entries)))

    def test_entrypoint_exports_the_api_key_without_printing_it(self):
        source = (ROOT / "infra/docker/entrypoint.sh").read_text()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            secrets = root / "secrets"
            secrets.mkdir()
            secret = "private-test-api-key"
            (secrets / "e2b-api-key").write_text(secret + "\n")
            observed = root / "observed"
            binary = root / "mkc-api"
            binary.write_text("#!/bin/sh\nprintf '%s' \"${MKC_E2B_API_KEY-unset}\" > \"$BUILD_TEST_OBSERVED\"\n")
            binary.chmod(0o755)
            entrypoint = root / "entrypoint.sh"
            entrypoint.write_text(source.replace("/var/run/mokly-secrets", str(secrets))
                                  .replace("/usr/local/bin/mkc-api", str(binary)))
            variables = {key: value for key, value in os.environ.items() if key != "MKC_E2B_API_KEY"}
            variables["BUILD_TEST_OBSERVED"] = str(observed)
            for mounted, expected in ((True, secret), (False, "unset")):
                if not mounted:
                    (secrets / "e2b-api-key").unlink()
                result = subprocess.run(["/bin/sh", str(entrypoint), "serve"], env=variables,
                                        capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(observed.read_text(), expected)
                self.assertNotIn(secret, result.stdout + result.stderr)

    def test_cidr_decimal_widths_match_the_runtime_parser(self):
        accepted = ["10.0.0.1/08", "10.0.0.1/00", "::1/064", "::1/000",
                    "010.000.000.001/24", "::ffff:192.000.002.001/120"]
        for destination in accepted:
            group = dict(BUILDS, deniedDestinations=[destination])
            with self.subTest(destination=destination):
                self.assertEqual(RENDER.values("production", self.inputs(group))["builds"], group)
        for destination in ("10.0.0.1/024", "10.0.0.1/000", "::1/0064", "::1/0000",
                            "010.000.000.001", "::ffff:192.000.002.001"):
            with self.subTest(destination=destination), self.assertRaises(ValueError):
                RENDER.values("production", self.inputs(dict(BUILDS, deniedDestinations=[destination])))


if __name__ == "__main__":
    unittest.main()
