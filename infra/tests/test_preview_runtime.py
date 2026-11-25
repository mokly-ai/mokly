"""Derivation, runtime loading and local generation of the preview password."""

import base64
import hashlib
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import unittest

from support import ROOT

VERIFIER_COMMAND = ROOT / "infra/scripts/preview-lifecycle.py"


def verifier_parts(verifier):
    empty, algorithm, params, salt, digest = verifier.split("$")
    return (empty, algorithm, params), base64.b64decode(salt + "==", validate=True), digest


def derive_hash(password, salt):
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=5, dklen=32)
    return base64.b64encode(digest).decode("ascii").rstrip("=")


class PreviewRuntimeTests(unittest.TestCase):
    def assert_verifier(self, password, verifier):
        prefix, salt, digest = verifier_parts(verifier)
        self.assertEqual(prefix, ("", "scrypt", "ln=14,r=8,p=5"))
        self.assertEqual(len(salt), 16)
        self.assertEqual(digest, derive_hash(password, salt))
        return salt, digest

    def test_shared_fixture_checks_only_its_password(self):
        password, verifier = (ROOT / "infra/tests/fixtures/preview-verifier.txt").read_text(
            encoding="utf-8"
        ).splitlines()
        salt, digest = self.assert_verifier(password, verifier)
        self.assertNotEqual(digest, derive_hash(password + " ", salt))

    def test_command_trims_all_stdin_and_warns_outside_the_verifier(self):
        password = "é" * 18 + "!"
        result = subprocess.run(
            ["python3", str(VERIFIER_COMMAND), "preview-verifier"],
            input=f" \n\t{password} \n\t",
            capture_output=True,
            encoding="utf-8",
            timeout=15,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_verifier(password, result.stdout)
        self.assertIn("fewer than 20 characters", result.stderr)
        self.assertNotIn(password, result.stderr)
        self.assertNotIn(password, result.stdout)

    def test_api_entrypoint_filters_and_loads_the_mounted_preview_verifier(self):
        _, verifier = (ROOT / "infra/tests/fixtures/preview-verifier.txt").read_text().splitlines()
        legacy = "a" * 64
        signing_key = "b" * 64
        cases = (
            ("legacy credential", legacy, "unset", True),
            ("scrypt verifier", verifier, verifier, False),
            ("absent file", None, "unset", False),
        )
        for name, mounted, expected, warn in cases:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                secrets = root / "mounted secrets"
                secrets.mkdir()
                (secrets / "catalogue-signing-key").write_text(signing_key)
                mounted_file = secrets / "preview-sign-in"
                if mounted is not None:
                    mounted_file.write_text(mounted)
                observed = root / "observed"
                api = root / "fake API"
                api.write_text(
                    "#!/bin/sh\n"
                    'printf "%s\\n%s\\n%s\\n" "$1" "$MKC_CATALOGUE_SIGNING_KEY" '
                    '"${MKC_PREVIEW_SIGN_IN_VERIFIER-unset}" > "$MKC_TEST_OBSERVED"\n'
                )
                api.chmod(0o755)
                variables = dict(
                    os.environ,
                    MKC_SECRETS_DIR=str(secrets),
                    MKC_API_BIN=str(api),
                    MKC_TEST_OBSERVED=str(observed),
                )
                variables.pop("MKC_PREVIEW_SIGN_IN_VERIFIER", None)
                variables.pop("MKC_CATALOGUE_SIGNING_KEY", None)
                result = subprocess.run(
                    ["/bin/sh", str(ROOT / "infra/docker/entrypoint.sh"), "serve"],
                    env=variables,
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(observed.read_text().splitlines(), ["serve", signing_key, expected])
                expected_stderr = (
                    f"Warning: Ignoring {mounted_file}. Expected a scrypt verifier.\n" if warn else ""
                )
                self.assertEqual(result.stderr, expected_stderr)
                self.assertEqual(result.stdout, "")

    def test_dev_api_creates_and_reuses_its_preview_password(self):
        for exported_signing_key in (False, True):
            with self.subTest(exported_signing_key=exported_signing_key):
                self.assert_dev_api_reuses_password(exported_signing_key)

    def assert_dev_api_reuses_password(self, exported_signing_key):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            scripts = root / "scripts/cloud"
            scripts.mkdir(parents=True)
            for name in ("dev-api.sh", "dev-publication-env.sh"):
                target = scripts / name
                target.write_text((ROOT / "scripts/cloud" / name).read_text())
                target.chmod(0o755)
            shutil.copytree(ROOT / "infra/scripts", root / "infra/scripts")
            commands = root / "commands"
            commands.mkdir()
            observed = root / "observed"
            cargo = commands / "cargo"
            cargo.write_text(
                "#!/usr/bin/env bash\n"
                "printf '%s\\n%s\\n%s\\n' \"$MKC_PREVIEW_SIGN_IN_EMAIL\" "
                "\"$MKC_PREVIEW_SIGN_IN_PLAN\" \"$MKC_PREVIEW_SIGN_IN_VERIFIER\" >> \"$MKC_TEST_OBSERVED\"\n"
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
            password_file = context / "preview-password"
            password = password_file.read_text()
            context_mode = stat.S_IMODE(context.stat().st_mode)
            password_mode = stat.S_IMODE(password_file.stat().st_mode)
            first_email, first_plan, first, second_email, second_plan, second = (
                observed.read_text().splitlines()
            )
        self.assertRegex(password, r"^[A-Za-z0-9_-]{32}$")
        self.assertEqual(context_mode, 0o700)
        self.assertEqual(password_mode, 0o600)
        self.assertEqual((first_email, first_plan), ("preview@mokly.ai", "team"))
        self.assertEqual((second_email, second_plan), (first_email, first_plan))
        first_salt, _ = self.assert_verifier(password, first)
        second_salt, _ = self.assert_verifier(password, second)
        self.assertNotEqual(first_salt, second_salt)


if __name__ == "__main__":
    unittest.main()
