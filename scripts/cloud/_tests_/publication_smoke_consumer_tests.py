"""Published consumers install npm latest without resolving the workspace."""

import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publication_smoke_consumer as consumer


class ConsumerInstallationTests(unittest.TestCase):
    def install(self, workspace, mutate=lambda _package, _shim: None):
        def npm(command, **_options):
            prefix = Path(command[command.index("--prefix") + 1])
            package = prefix / "node_modules/@mokly/mokly"
            shim = package / "bin/mokly.mjs"
            shim.parent.mkdir(parents=True)
            shim.write_text("#!/usr/bin/env node\n")
            (package / "package.json").write_text(json.dumps({
                "name": "@mokly/mokly", "version": "9.8.7", "bin": {"mokly": "./bin/mokly.mjs"},
            }))
            mutate(package, shim)
            return subprocess.CompletedProcess(command, 0, "", "")

        with patch("subprocess.run", side_effect=npm) as run:
            installed = consumer.install_published_cli(workspace)
        return installed, run

    def test_latest_install_has_its_own_prefix_and_records_the_resolved_version(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                installed, run = self.install(workspace)
            self.assertEqual(installed.version, "9.8.7")
            self.assertNotEqual(installed.installation, workspace)
            command = run.call_args.args[0]
            self.assertEqual(command[:2], ["npm", "install"])
            self.assertEqual(command[command.index("--prefix") + 1], str(installed.installation))
            self.assertIn("@mokly/mokly@latest", command)
            self.assertIn("--workspaces=false", command)
            self.assertEqual(run.call_args.kwargs["cwd"], installed.installation)
            self.assertTrue(installed.executable.is_relative_to(installed.installation))
            self.assertFalse(installed.executable.is_symlink())
            self.assertEqual(output.getvalue(), "Published CLI installed: @mokly/mokly@9.8.7\n")

    def test_linked_packages_and_executables_or_paths_outside_the_prefix_are_rejected(self):
        def package_link(package, _shim):
            target = package.with_name("real-package")
            package.rename(target)
            package.symlink_to(target, target_is_directory=True)

        def executable_link(_package, shim):
            target = shim.with_name("real-shim.mjs")
            shim.rename(target)
            shim.symlink_to(target)

        def outside_package(package, _shim):
            target = package.parents[3] / "outside-package"
            package.rename(target)
            package.parent.rename(package.parent.with_name("original-scope"))
            package.parent.symlink_to(target.parent, target_is_directory=True)
            target.rename(target.parent / "mokly")

        def outside_executable(package, _shim):
            target = package.parents[3] / "outside-shim.mjs"
            target.write_text("#!/usr/bin/env node\n")
            metadata = json.loads((package / "package.json").read_text())
            metadata["bin"]["mokly"] = str(target)
            (package / "package.json").write_text(json.dumps(metadata))

        for mutate in [package_link, executable_link, outside_package, outside_executable]:
            with self.subTest(case=mutate.__name__), tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(AssertionError, "^Published CLI is linked or outside its isolated installation$"):
                    self.install(Path(directory), mutate)


if __name__ == "__main__":
    unittest.main()
