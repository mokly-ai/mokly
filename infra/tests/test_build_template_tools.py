"""Check the candidate probe against controlled PATH entries."""

import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from support import ROOT


SCRIPT = ROOT / "infra/e2b/tests/assert_build_template.py"
SPEC = importlib.util.spec_from_file_location("assert_build_template", SCRIPT)
ASSERTION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ASSERTION)
VERSION = (ROOT / ".nvmrc").read_text().strip()
HOST_ACCESS = os.access


def write_tool(path):
    path.touch()
    path.chmod(0o755)


class BuildTemplateProbeFixture:
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.scratch = Path(scratch.name)
        self.bin = self.scratch / "bin"
        self.bin.mkdir()
        for executable in ("node", "npm", "npx", "corepack", "git", "curl", "sha256sum",
                           "python3", "cc", "c++", "make", "g++", "ar", "ld", "pkg-config",
                           "libtool"):
            write_tool(self.bin / executable)
        self.environment = {
            "PATH": str(self.bin),
            "HOME": ASSERTION.TEMPLATE_HOME,
            ASSERTION.PROBE_KEY: ASSERTION.PROBE_VALUE,
        }
        self.account = SimpleNamespace(pw_name="user", pw_dir="/home/user")
        # Stands in for the sandbox's /workspace: a folder outside every Git repository.
        self.workspace = self.scratch / "workspace"
        self.workspace.mkdir()
        patches = (
            patch.dict(os.environ, self.environment, clear=True),
            patch.object(ASSERTION.os, "getuid", return_value=1000),
            patch.object(ASSERTION.os, "geteuid", return_value=1000),
            patch.object(ASSERTION.pwd, "getpwuid", return_value=self.account),
            patch.object(ASSERTION.os, "access",
                         side_effect=lambda path, mode: path == "/bin/sh" or HOST_ACCESS(path, mode)),
            patch.object(ASSERTION.os, "confstr", return_value="glibc 2.28"),
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "is_file", return_value=True),
            patch.object(Path, "stat", return_value=SimpleNamespace(st_uid=1000)),
            patch.object(Path, "exists", return_value=False),
            patch.object(Path, "is_symlink", return_value=False),
            patch.object(ASSERTION.tempfile, "TemporaryFile", return_value=MagicMock()),
            patch.object(ASSERTION.tempfile, "TemporaryDirectory", side_effect=self.new_directory),
            patch.object(ASSERTION.subprocess, "run", side_effect=self.run_command),
        )
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def new_directory(self, **kwargs):
        """Give each probe directory its own new folder, as a fresh sandbox does."""
        directory = Path(tempfile.mkdtemp(dir=self.workspace))
        context = MagicMock()
        context.__enter__.return_value = str(directory)
        return context

    def check_probe_call(self, kwargs):
        self.assertNotIn("env", kwargs)
        self.assertNotIn("shell", kwargs)
        self.assertEqual(kwargs["timeout"], 10)
        self.assertIs(kwargs["stdin"], subprocess.DEVNULL)

    def run_command(self, argv, **kwargs):
        self.check_probe_call(kwargs)
        if argv[0] == "node":
            output = "v" + VERSION
        elif argv == ["git", "--version"]:
            output = "git version 2.43.0"
        elif argv == ["./probe"]:
            output = "native-build-ok"
        else:
            output = "shell-ok"
        return SimpleNamespace(returncode=0, stdout=output)


class BuildTemplateToolsTests(BuildTemplateProbeFixture, unittest.TestCase):
    def test_duplicate_tools_on_path_fail(self):
        for executable in ("node", "npm", "npx", "corepack", "python3", "git"):
            with self.subTest(executable=executable):
                other = self.scratch / f"other-{executable}-bin"
                other.mkdir()
                write_tool(other / executable)
                with patch.dict(os.environ, {"PATH": f"{self.bin}{os.pathsep}{other}"}), self.assertRaises(
                    ASSERTION.TemplateAssertionError
                ) as caught:
                    ASSERTION.verify(VERSION)
                self.assertEqual(str(caught.exception), f"{executable} has multiple copies on PATH")

    def test_aliased_path_entry_passes_and_build_tools_run(self):
        alias = self.scratch / "alias-bin"
        alias.symlink_to(self.bin, target_is_directory=True)
        with patch.dict(os.environ, {"PATH": f"{self.bin}{os.pathsep}{alias}"}), patch.object(
            ASSERTION.subprocess, "run", side_effect=self.run_command
        ) as run:
            ASSERTION.verify(VERSION)
        commands = [call.args[0] for call in run.call_args_list]
        for executable in ("cc", "c++", "make", "pkg-config", "libtool"):
            with self.subTest(executable=executable):
                self.assertIn([executable, "--version"], commands)

    def test_required_tools_missing_from_path_fail(self):
        for executable in ("npx", "cc", "c++", "make", "g++", "ar", "ld", "pkg-config", "libtool"):
            path = self.bin / executable
            path.unlink()
            with self.subTest(executable=executable):
                with self.assertRaises(ASSERTION.TemplateAssertionError) as caught:
                    ASSERTION.verify(VERSION)
                self.assertEqual(str(caught.exception), f"{executable} is missing from PATH")
            write_tool(path)

    def test_native_build_requires_make_and_the_expected_program_output(self):
        for executable, status in (("make", 1), ("./probe", 1), ("./probe", 0)):
            def fail_build(argv, **kwargs):
                if argv == [executable]:
                    self.check_probe_call(kwargs)
                    return SimpleNamespace(returncode=status, stdout="private stdout", stderr="private stderr")
                return self.run_command(argv, **kwargs)

            with self.subTest(executable=executable, status=status), patch.object(
                ASSERTION.subprocess, "run", side_effect=fail_build
            ):
                with self.assertRaises(ASSERTION.TemplateAssertionError) as caught:
                    ASSERTION.verify(VERSION)
                self.assertEqual(str(caught.exception), "native build with make, cc, g++, ar and ld failed")
