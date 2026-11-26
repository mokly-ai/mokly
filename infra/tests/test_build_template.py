"""Local regression checks for the candidate assertion; no provider access."""

import os
import re
from pathlib import Path
import shutil
from types import SimpleNamespace
import subprocess
import unittest
from unittest.mock import patch

from support import ROOT
from test_build_template_tools import ASSERTION, VERSION, BuildTemplateProbeFixture


# Captured before the tests patch the environment, subprocess.run and shutil.which.
HOST_PATH = os.environ.get("PATH", "")
HOST_NPM = shutil.which("npm")
HOST_RUN = subprocess.run
HOST_GIT = shutil.which("git")
# Debian bookworm's Git: it predates `cat-file -Z`, which Mokly's base reader needs.
OLD_GIT_VERSION = "git version 2.39.5"


def pinned_base_images(dockerfile):
    bases = re.findall(r"^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)", dockerfile,
                       re.MULTILINE | re.IGNORECASE)
    return bool(bases) and all(re.fullmatch(
        r"debian:[A-Za-z0-9_.-]+@sha256:[0-9a-f]{64}", base) for base in bases)


class BuildTemplatePinTests(unittest.TestCase):
    def test_checked_in_base_uses_a_tag_and_immutable_digest(self):
        self.assertTrue(pinned_base_images(
            (ROOT / "infra/e2b/build/e2b.Dockerfile").read_text()))


class BuildTemplateTests(BuildTemplateProbeFixture, unittest.TestCase):
    def fake_git(self, version, cat_file_status):
        """Answer the probe's Git calls like a Git that prints `version`."""
        def run(argv, **kwargs):
            if argv == ["git", "--version"]:
                self.check_probe_call(kwargs)
                return SimpleNamespace(returncode=0, stdout=version)
            if argv[:2] == ["git", "cat-file"]:
                self.check_probe_call(kwargs)
                return SimpleNamespace(returncode=cat_file_status, stdout="",
                                       stderr="error: unknown switch `Z'")
            return self.run_command(argv, **kwargs)
        return run

    def run_with_host_tools(self, argv, **kwargs):
        """Run the probe's npm ci and Git checks with host tools, so they judge the real argv."""
        if argv[0] == "git":
            return self.run_with_host_git(argv, **kwargs)
        if argv[:2] != ["npm", "ci"]:
            return self.run_command(argv, **kwargs)
        self.check_probe_call(kwargs)
        self.assertIsNotNone(HOST_NPM, "this test needs npm on PATH")
        npm_home = self.scratch / "npm-home"
        environment = {"PATH": HOST_PATH, "HOME": str(npm_home),
                       "npm_config_cache": str(npm_home / "cache"),
                       "npm_config_userconfig": str(npm_home / "npmrc"),
                       "npm_config_globalconfig": str(npm_home / "global-npmrc")}
        return HOST_RUN([HOST_NPM, *argv[1:]], env=environment, **kwargs)

    def run_with_host_git(self, argv, **kwargs):
        self.check_probe_call(kwargs)
        self.assertIsNotNone(HOST_GIT, "this test needs git on PATH")
        # The probe starts in /workspace, so a Git call without its own directory runs there,
        # and the search stops at the scratch folder instead of finding the Mokly checkout.
        environment = {"PATH": HOST_PATH, "HOME": str(self.scratch),
                       "GIT_CEILING_DIRECTORIES": str(self.scratch),
                       "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull}
        kwargs["cwd"] = kwargs.get("cwd") or self.workspace
        return HOST_RUN([HOST_GIT, *argv[1:]], env=environment, **kwargs)

    def test_complete_template_passes_with_one_added_entry(self):
        with patch.object(ASSERTION.subprocess, "run", side_effect=self.run_with_host_tools) as run:
            ASSERTION.verify(VERSION)
        self.assertEqual(run.call_count, 18)

    def test_git_without_cat_file_nul_batches_fails(self):
        # Bookworm's Git 2.39.5 exits 129 on `cat-file -Z`, so Mokly cannot read a base.
        cases = [(OLD_GIT_VERSION, 129, "^Mokly base reads require Git 2.43 or newer$"),
                 ("git version 2.42.4", 0, "^Mokly base reads require Git 2.43 or newer$"),
                 ("git version 2.39.5 (Apple Git-154)", 0, "^Mokly base reads require Git 2.43"),
                 ("not a version", 0, "^Mokly base reads require Git 2.43 or newer$"),
                 ("git version 2.43.0", 129, "^git cat-file --batch --filters -Z failed$"),
                 ("git version 2.56.1", 128, "^git cat-file --batch --filters -Z failed$")]
        for version, status, message in cases:
            with self.subTest(version=version, status=status), patch.object(
                ASSERTION.subprocess, "run", side_effect=self.fake_git(version, status)
            ):
                with self.assertRaisesRegex(ASSERTION.TemplateAssertionError, message):
                    ASSERTION.verify(VERSION)

    def test_git_2_43_or_newer_with_cat_file_nul_batches_passes(self):
        for version in ("git version 2.43.0", "git version 2.56.1",
                        "git version 2.45.0.windows.1", "git version 3.0.0"):
            with self.subTest(version=version), patch.object(
                ASSERTION.subprocess, "run", side_effect=self.fake_git(version, 0)
            ) as run:
                ASSERTION.verify(VERSION)
                self.assertIn(["git", "cat-file", "--batch", "--filters", "-Z"],
                              [call.args[0] for call in run.call_args_list])

    def test_npm_with_files_of_two_releases_fails(self):
        # A Node tarball unpacked over an older npm prints its version but cannot run npm ci.
        def mixed_npm(argv, **kwargs):
            if argv[:2] == ["npm", "ci"]:
                return SimpleNamespace(returncode=1, stdout="", stderr=(
                    "npm error Class extends value undefined is not a constructor or null"))
            return self.run_command(argv, **kwargs)

        with patch.object(ASSERTION.subprocess, "run", side_effect=mixed_npm):
            with self.assertRaisesRegex(ASSERTION.TemplateAssertionError,
                                        "^npm ci of an empty project failed$"):
                ASSERTION.verify(VERSION)

    def test_native_cli_requires_glibc_2_28_or_newer(self):
        cases = [("glibc 2.27", False), ("glibc 2.28", True),
                 ("glibc 2.40", True), ("glibc 3.0", True),
                 ("musl 1.2", False), (None, False)]
        for library, accepted in cases:
            with self.subTest(library=library), patch.object(
                ASSERTION.os, "confstr", return_value=library
            ):
                if accepted:
                    ASSERTION.verify(VERSION)
                else:
                    with self.assertRaisesRegex(ASSERTION.TemplateAssertionError, "glibc 2.28"):
                        ASSERTION.verify(VERSION)

    def test_replaced_or_changed_process_environment_fails(self):
        for key, value in (("HOME", None), ("HOME", "/root"), (ASSERTION.PROBE_KEY, None),
                           (ASSERTION.PROBE_KEY, "wrong")):
            with self.subTest(key=key, value=value), patch.dict(os.environ, clear=False):
                if value is None:
                    os.environ.pop(key)
                else:
                    os.environ[key] = value
                with self.assertRaises(ASSERTION.TemplateAssertionError):
                    ASSERTION.verify(VERSION)

    def test_wrong_user_uid_home_or_effective_uid_fails(self):
        for module, name, value in ((ASSERTION.os, "getuid", 0),
                                    (ASSERTION.os, "geteuid", 0),
                                    (ASSERTION.pwd, "getpwuid", SimpleNamespace(pw_name="root", pw_dir="/root")),
                                    (ASSERTION.pwd, "getpwuid", SimpleNamespace(pw_name="user", pw_dir="/other"))):
            with self.subTest(name=name, value=value), patch.object(module, name, return_value=value):
                with self.assertRaises(ASSERTION.TemplateAssertionError):
                    ASSERTION.verify(VERSION)

    def test_workspace_must_exist_belong_to_user_and_allow_writes(self):
        for name, kwargs in (("is_dir", {"return_value": False}),
                             ("stat", {"return_value": SimpleNamespace(st_uid=0)})):
            with self.subTest(name=name), patch.object(Path, name, **kwargs):
                with self.assertRaises(ASSERTION.TemplateAssertionError):
                    ASSERTION.verify(VERSION)
        with patch.object(ASSERTION.tempfile, "TemporaryFile", side_effect=PermissionError):
            with self.assertRaisesRegex(ASSERTION.TemplateAssertionError, "not writable"):
                ASSERTION.verify(VERSION)

    def test_tools_shell_and_exact_node_version_are_required(self):
        with patch.object(ASSERTION.shutil, "which", return_value=None):
            with self.assertRaisesRegex(ASSERTION.TemplateAssertionError, "missing from PATH"):
                ASSERTION.verify(VERSION)
        with self.assertRaisesRegex(ASSERTION.TemplateAssertionError, "Node release differs"):
            ASSERTION.verify("0.0.0")
        for name in ("is_file",):
            with patch.object(Path, name, return_value=False):
                with self.assertRaisesRegex(ASSERTION.TemplateAssertionError, "/bin/sh"):
                    ASSERTION.verify(VERSION)

    def test_nonzero_missing_and_timed_out_tools_fail_without_command_output(self):
        failures = (SimpleNamespace(returncode=1, stdout="secret"), OSError("secret"),
                    subprocess.TimeoutExpired("secret", 10))
        for failure in failures:
            kwargs = {"side_effect": failure} if isinstance(failure, Exception) else {"return_value": failure}
            with self.subTest(failure=failure), patch.object(ASSERTION.subprocess, "run", **kwargs):
                with self.assertRaises(ASSERTION.TemplateAssertionError) as caught:
                    ASSERTION.verify(VERSION)
                self.assertNotIn("secret", str(caught.exception))

    def test_every_credential_environment_key_is_rejected_even_if_empty(self):
        for key in ASSERTION.SECRET_KEYS:
            with self.subTest(key=key), patch.dict(os.environ, {key: ""}):
                with self.assertRaisesRegex(ASSERTION.TemplateAssertionError, "credential environment"):
                    ASSERTION.verify(VERSION)

    def test_credential_files_and_symlinks_are_rejected(self):
        for relative in ASSERTION.CREDENTIAL_FILES:
            for method in ("exists", "is_symlink"):
                with self.subTest(relative=relative, method=method):
                    with patch.object(Path, method, lambda path: path == Path("/home/user") / relative):
                        with self.assertRaisesRegex(ASSERTION.TemplateAssertionError, "credential file"):
                            ASSERTION.verify(VERSION)
        with patch.object(Path, "exists", lambda path: str(path) == "/var/run/mokly-secrets"):
            with self.assertRaisesRegex(ASSERTION.TemplateAssertionError, "cloud secret mount"):
                ASSERTION.verify(VERSION)

    def test_definition_and_assertion_use_the_same_template_environment(self):
        docker = (ROOT / "infra/e2b/build/e2b.Dockerfile").read_text()
        definition = (ROOT / "infra/e2b/build/e2b.toml").read_text()
        self.assertIn("cpu_count = 2\n", definition)
        self.assertIn("memory_mb = 4096\n", definition)
        self.assertRegex(definition, r'template_name = "mokly-build-v[1-9][0-9]*"')
        self.assertNotIn("template_id", definition)
        self.assertIn("ENV HOME=" + ASSERTION.TEMPLATE_HOME, docker)
        self.assertIn("sha256sum --check --strict", docker)
        self.assertEqual((ROOT / "infra/e2b/build/.dockerignore").read_text().splitlines(),
                         ["*", "!e2b.Dockerfile"])


if __name__ == "__main__":
    unittest.main()
