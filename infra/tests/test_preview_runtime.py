"""Runtime loading and local generation of the preview sign-in credential."""

import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest

from support import ROOT


class PreviewRuntimeTests(unittest.TestCase):
    def test_api_entrypoint_exports_each_mounted_file_without_printing_it(self):
        entrypoint = (ROOT / "infra/docker/entrypoint.sh").read_text()
        for path, setting in (
            ("catalogue-signing-key", "MKC_CATALOGUE_SIGNING_KEY"),
            ("preview-sign-in", "MKC_PREVIEW_SIGN_IN_SECRET"),
        ):
            with self.subTest(path=path):
                self.assertIn(f"[ -f /var/run/mokly-secrets/{path} ]", entrypoint)
                self.assertIn(
                    f"{setting}=$(cat /var/run/mokly-secrets/{path})", entrypoint
                )
                self.assertIn(f"export {setting}", entrypoint)
        self.assertNotIn("set -x", entrypoint)

    def test_dev_api_creates_and_reuses_its_preview_credential(self):
        for exported_signing_key in (False, True):
            with self.subTest(exported_signing_key=exported_signing_key):
                self.assert_dev_api_reuses_credential(exported_signing_key)

    def assert_dev_api_reuses_credential(self, exported_signing_key):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            scripts = root / "scripts"
            scripts.mkdir()
            for name in ("dev-api.sh", "dev-publication-env.sh"):
                target = scripts / name
                target.write_text((ROOT / "scripts" / name).read_text())
                target.chmod(0o755)
            commands = root / "commands"
            commands.mkdir()
            observed = root / "observed"
            cargo = commands / "cargo"
            cargo.write_text(
                "#!/usr/bin/env bash\n"
                "printf '%s\\n%s\\n%s\\n' \"$MKC_PREVIEW_SIGN_IN_EMAIL\" "
                "\"$MKC_PREVIEW_SIGN_IN_PLAN\" \"$MKC_PREVIEW_SIGN_IN_SECRET\" >> \"$MKC_TEST_OBSERVED\"\n"
            )
            cargo.chmod(0o755)
            variables = dict(
                os.environ,
                PATH=str(commands) + ":" + os.environ["PATH"],
                MKC_TEST_OBSERVED=str(observed),
            )
            if exported_signing_key:
                variables["MKC_CATALOGUE_SIGNING_KEY"] = "b" * 64
            else:
                variables.pop("MKC_CATALOGUE_SIGNING_KEY", None)
            for _attempt in range(2):
                result = subprocess.run(
                    ["bash", str(scripts / "dev-api.sh")],
                    env=variables,
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
            context = root / ".context"
            secret_file = context / "preview-sign-in"
            secret = secret_file.read_text()
            context_mode = stat.S_IMODE(context.stat().st_mode)
            secret_mode = stat.S_IMODE(secret_file.stat().st_mode)
            lines = observed.read_text().splitlines()
        self.assertRegex(secret, r"^[a-f0-9]{64}$")
        self.assertEqual(context_mode, 0o700)
        self.assertEqual(secret_mode, 0o600)
        self.assertEqual(lines, ["preview@mokly.ai", "team", secret] * 2)


if __name__ == "__main__":
    unittest.main()
