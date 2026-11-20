"""BuildKit image-gate capacity diagnostics use bounded real commands."""

import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest

from support import ROOT


class BuildkitCapacityTests(unittest.TestCase):
    def write_tool(self, directory, name, source):
        path = Path(directory, name)
        path.write_text(textwrap.dedent(source).lstrip())
        path.chmod(0o755)

    def fixture(self, temporary, failed_build="", du_delay="0"):
        binary = Path(temporary, "bin")
        binary.mkdir()
        root = Path(temporary, "buildkit-root")
        root.mkdir()
        build_log = Path(temporary, "builds.log")
        self.write_tool(binary, "sudo", """
            #!/bin/bash
            if [[ ${1:-} == -n ]]; then shift; fi
            exec "$@"
        """)
        self.write_tool(binary, "df", """
            #!/bin/bash
            printf 'fixture-df %s\n' "$*"
        """)
        self.write_tool(binary, "du", """
            #!/bin/bash
            sleep "$MKC_TEST_DU_DELAY"
            printf '4096\t%s\n' "${2:-${1:-}}"
        """)
        self.write_tool(binary, "buildctl", """
            #!/bin/bash
            [[ $* == 'debug workers' ]]
        """)
        self.write_tool(binary, "crane", """
            #!/bin/bash
            exit 0
        """)
        self.write_tool(binary, "bash", """
            #!/bin/bash
            case ${1:-} in
              infra/scripts/report-buildkit-capacity.sh)
                exec /bin/bash "$@"
                ;;
              infra/scripts/build-api.sh|infra/scripts/build-catalogue.sh|infra/scripts/build-app.sh)
                name=$(basename "$1")
                printf '%s\n' "$name" >> "$MKC_TEST_BUILD_LOG"
                if [[ $name == "$MKC_TEST_FAIL_BUILD" ]]; then exit 42; fi
                ;;
              *)
                exec /bin/bash "$@"
                ;;
            esac
        """)
        return dict(
            os.environ,
            PATH=str(binary) + ":/usr/bin:/bin",
            MKC_BUILDKIT_DIAGNOSTIC_TIMEOUT="0.05",
            MKC_BUILDKIT_ROOT=str(root),
            MKC_BUILDKIT_SUDO=str(binary / "sudo"),
            MKC_TEST_BUILD_LOG=str(build_log),
            MKC_TEST_DU_DELAY=du_delay,
            MKC_TEST_FAIL_BUILD=failed_build,
        )

    def test_image_gate_reports_entry_and_each_required_build(self):
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.fixture(temporary)
            result = subprocess.run(
                ["/bin/bash", "infra/scripts/check-image.sh"], cwd=ROOT,
                env=environment, capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                Path(environment["MKC_TEST_BUILD_LOG"]).read_text().splitlines(),
                ["build-api.sh", "build-catalogue.sh", "build-app.sh"])
            for phase in (
                "image gate entry", "API image complete",
                "catalogue image complete", "app image complete",
            ):
                self.assertIn(f"BuildKit capacity ({phase})", result.stdout)

    def test_image_gate_reports_capacity_at_the_failure_boundary(self):
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.fixture(temporary, failed_build="build-api.sh")
            result = subprocess.run(
                ["/bin/bash", "infra/scripts/check-image.sh"], cwd=ROOT,
                env=environment, capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 42, result.stderr)
            self.assertEqual(
                Path(environment["MKC_TEST_BUILD_LOG"]).read_text().splitlines(),
                ["build-api.sh"])
            self.assertIn("BuildKit capacity (image gate entry)", result.stdout)
            self.assertIn("BuildKit capacity (API image failure)", result.stdout)

    def test_root_usage_probe_is_bounded_without_hiding_the_gate(self):
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.fixture(temporary, du_delay="1")
            result = subprocess.run(
                ["/bin/bash", "infra/scripts/report-buildkit-capacity.sh", "fixture"],
                cwd=ROOT, env=environment, capture_output=True, text=True, timeout=2)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("BuildKit capacity (fixture)", result.stdout)
            self.assertIn("BuildKit root usage probe exceeded 0.05 seconds", result.stderr)


if __name__ == "__main__":
    unittest.main()
