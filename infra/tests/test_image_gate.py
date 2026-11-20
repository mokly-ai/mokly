"""The image stage skips absent tools and fails installed but unreachable BuildKit."""

import os
from pathlib import Path
import pwd
import shutil
import signal
import subprocess
import tempfile
import textwrap
import unittest

from support import ROOT


class ImageGateTests(unittest.TestCase):
    def write_tool(self, directory, name, source):
        path = Path(directory, name)
        path.write_text(textwrap.dedent(source).lstrip())
        path.chmod(0o755)

    def buildkit_fixture(
        self, temporary, daemon_mode="ready", worker_mode="ready",
        worker_snapshotter="overlayfs", process_delay="0",
        readiness_attempts="100",
    ):
        binary = Path(temporary, "bin")
        binary.mkdir()
        self.write_tool(binary, "sudo", """
            #!/usr/bin/env bash
            if [[ ${1:-} == -n ]]; then shift; fi
            sleep "$MKC_TEST_PROCESS_DELAY"
            if [[ ${1:-} == chown ]]; then exit 0; fi
            exec "$@"
        """)
        self.write_tool(binary, "buildkitd", """
            #!/usr/bin/env python3
            import os
            from pathlib import Path
            import socket
            import sys
            import time

            Path(os.environ["MKC_TEST_DAEMON_PID"]).write_text(str(os.getpid()))
            if os.environ["MKC_TEST_DAEMON_MODE"] == "exit":
                print("fixture daemon failed during worker setup", file=sys.stderr)
                raise SystemExit(23)
            arguments = sys.argv[1:]
            Path(os.environ["MKC_BUILDKIT_ROOT"]).mkdir(parents=True, exist_ok=True)
            if ("--containerd-worker=false" not in arguments
                    or "--debug" not in arguments
                    or "--oci-worker-snapshotter=auto" not in arguments
                    or arguments[arguments.index("--root") + 1]
                    != os.environ["MKC_BUILDKIT_ROOT"]
                    or arguments[arguments.index("--oci-worker-binary") + 1]
                    != os.environ["MKC_TEST_RUNTIME"]):
                print("fixture daemon received invalid worker arguments", file=sys.stderr)
                raise SystemExit(24)
            address = sys.argv[sys.argv.index("--addr") + 1]
            path = Path(address.removeprefix("unix://"))
            path.parent.mkdir(parents=True, exist_ok=True)
            path.unlink(missing_ok=True)
            listener = socket.socket(socket.AF_UNIX)
            listener.bind(str(path))
            listener.listen()
            print("fixture daemon listening", file=sys.stderr, flush=True)
            while True:
                time.sleep(1)
        """)
        self.write_tool(binary, "buildkit-runc", """
            #!/usr/bin/env bash
            exit 0
        """)
        self.write_tool(binary, "buildctl", """
            #!/usr/bin/env python3
            import os
            from pathlib import Path
            import sys
            import time

            time.sleep(float(os.environ["MKC_TEST_PROCESS_DELAY"]))

            if sys.argv[1:] != ["--addr", os.environ["BUILDKIT_HOST"],
                                "debug", "workers", "--verbose"]:
                print("fixture buildctl received invalid probe arguments", file=sys.stderr)
                raise SystemExit(8)
            counter = Path(os.environ["MKC_TEST_BUILDCTL_COUNTER"])
            calls = int(counter.read_text()) + 1 if counter.exists() else 1
            counter.write_text(str(calls))
            if os.environ["MKC_TEST_WORKER_MODE"] == "wait" or calls == 1:
                print("fixture worker is not ready", file=sys.stderr)
                raise SystemExit(7)
            print("ID:\t\tfixture-worker")
            print("Platforms:\tlinux/amd64")
            print("Labels:")
            print("\torg.mobyproject.buildkit.worker.snapshotter:\t\t"
                  + os.environ["MKC_TEST_WORKER_SNAPSHOTTER"])
        """)
        return dict(
            os.environ,
            PATH=str(binary) + ":/usr/bin:/bin",
            BUILDKIT_HOST="unix://" + str(Path(temporary, "buildkit.sock")),
            MKC_BUILDKIT_LOG=str(Path(temporary, "buildkit.log")),
            MKC_BUILDKIT_ROOT=str(Path(temporary, "buildkit-root")),
            MKC_BUILDKIT_ATTEMPTS=readiness_attempts,
            MKC_BUILDKIT_INTERVAL="0.01",
            MKC_BUILDKIT_SUDO=str(binary / "sudo"),
            MKC_TEST_BUILDCTL_COUNTER=str(Path(temporary, "buildctl-calls")),
            MKC_TEST_DAEMON_PID=str(Path(temporary, "buildkit.pid")),
            MKC_TEST_DAEMON_MODE=daemon_mode,
            MKC_TEST_PROCESS_DELAY=process_delay,
            MKC_TEST_RUNTIME=str(binary / "buildkit-runc"),
            MKC_TEST_WORKER_MODE=worker_mode,
            MKC_TEST_WORKER_SNAPSHOTTER=worker_snapshotter,
        )

    def run_buildkit_starter(self, environment):
        try:
            return subprocess.run(
                ["/bin/bash", "infra/scripts/start-buildkit.sh"], cwd=ROOT,
                env=environment, capture_output=True, text=True, timeout=5)
        finally:
            pid_file = Path(environment["MKC_TEST_DAEMON_PID"])
            if pid_file.exists():
                try:
                    os.kill(int(pid_file.read_text()), signal.SIGTERM)
                except ProcessLookupError:
                    pass

    def run_ownership_handoff_starter(self, temporary):
        sudo = shutil.which("sudo")
        setpriv = shutil.which("setpriv")
        if not sudo or not setpriv:
            self.skipTest("sudo/setpriv unavailable")
        if subprocess.run([sudo, "-n", "true"], capture_output=True).returncode:
            self.skipTest("passwordless sudo unavailable")

        identity = pwd.getpwnam("nobody")
        binary = Path(temporary, "ownership-bin")
        binary.mkdir()
        binary.parent.chmod(0o755)
        self.write_tool(binary, "sudo", f"""
            #!/usr/bin/env bash
            if [[ ${{1:-}} == -n ]]; then shift; fi
            if [[ ${{1:-}} == chown ]]; then
              exec {sudo} -n "$@"
            fi
            exec {sudo} -n {setpriv} --reuid={identity.pw_uid} \
              --regid={identity.pw_gid} --clear-groups "$@"
        """)
        self.write_tool(binary, "buildkitd", """
            #!/usr/bin/env bash
            echo 'fixture daemon crossed privilege boundary' >&2
            sleep 0.05
            exit 23
        """)
        for tool in ("buildctl", "buildkit-runc"):
            self.write_tool(binary, tool, """
                #!/usr/bin/env bash
                exit 0
            """)

        basename = Path(temporary).name
        socket = Path("/tmp", basename + "-buildkit.sock")
        log = Path("/tmp", basename + "-buildkit.log")
        environment = dict(
            os.environ,
            PATH=str(binary) + ":/usr/bin:/bin",
            BUILDKIT_HOST="unix://" + str(socket),
            MKC_BUILDKIT_LOG=str(log),
            MKC_BUILDKIT_ROOT=str(Path(temporary, "ownership-root")),
            MKC_BUILDKIT_ATTEMPTS="100",
            MKC_BUILDKIT_INTERVAL="0.01",
            MKC_BUILDKIT_SUDO=str(binary / "sudo"),
        )
        try:
            return subprocess.run(
                ["/bin/bash", "infra/scripts/start-buildkit.sh"], cwd=ROOT,
                env=environment, capture_output=True, text=True, timeout=5)
        finally:
            subprocess.run(
                [sudo, "-n", "rm", "-f", str(socket), str(log)], check=False)

    def test_absent_tool_has_an_actionable_skip(self):
        with tempfile.TemporaryDirectory() as temporary:
            for tool in ("dirname", "bash"):
                Path(temporary, tool).symlink_to(shutil.which(tool))
            result = subprocess.run(["/bin/bash", "infra/scripts/check-image.sh"], cwd=ROOT,
                env=dict(os.environ, PATH=temporary), capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("SKIP workload image builds: buildctl is missing", result.stdout)
            self.assertIn("infra/scripts/install-build-tools.sh", result.stdout)

    @unittest.skipUnless(shutil.which("buildctl") and shutil.which("crane"), "BuildKit/crane unavailable")
    def test_installed_unreachable_buildkit_fails_instead_of_skipping(self):
        with tempfile.TemporaryDirectory() as temporary:
            result = subprocess.run(["bash", "infra/scripts/check-image.sh"], cwd=ROOT,
                env=dict(os.environ, BUILDKIT_HOST="unix://" + temporary + "/missing.sock"),
                capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn("infra/scripts/start-buildkit.sh", result.stderr)
            self.assertNotIn("SKIP", result.stdout)

    def test_starter_waits_for_a_ready_worker_not_only_the_socket(self):
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.buildkit_fixture(temporary)
            result = self.run_buildkit_starter(environment)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("ID:\t\tfixture-worker", result.stdout)
            self.assertIn("BuildKit worker snapshotter: overlayfs", result.stdout)
            self.assertGreaterEqual(
                int(Path(environment["MKC_TEST_BUILDCTL_COUNTER"]).read_text()), 2)

    def test_starter_reports_an_early_daemon_exit_and_its_log(self):
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.buildkit_fixture(temporary, daemon_mode="exit")
            result = self.run_buildkit_starter(environment)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn("BuildKit daemon exited before readiness", result.stderr)
            self.assertIn("fixture daemon failed during worker setup", result.stderr)

    def test_starter_rejects_the_native_copying_fallback_by_default(self):
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.buildkit_fixture(
                temporary, worker_snapshotter="native")
            result = self.run_buildkit_starter(environment)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn(
                "requires overlayfs or fuse-overlayfs, but auto selected native",
                result.stderr)
            self.assertIn("BuildKit capacity (startup failure)", result.stderr)

    def test_starter_allows_an_explicit_native_fallback_with_diagnostics(self):
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.buildkit_fixture(
                temporary, worker_snapshotter="native")
            environment["MKC_BUILDKIT_REQUIRE_LAYERED"] = "false"
            result = self.run_buildkit_starter(environment)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(
                "auto selected native; parent snapshots require full copies",
                result.stderr)
            self.assertIn("BuildKit worker snapshotter: native", result.stdout)
            self.assertIn("BuildKit capacity (daemon ready)", result.stdout)

    def test_starter_rejects_an_unrecognized_worker_snapshotter(self):
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.buildkit_fixture(
                temporary, worker_snapshotter="unknown")
            result = self.run_buildkit_starter(environment)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn(
                "worker reported unsupported snapshotter: unknown",
                result.stderr)

    def test_starter_timeout_reports_daemon_and_worker_diagnostics(self):
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.buildkit_fixture(
                temporary, worker_mode="wait", process_delay="0.01",
                readiness_attempts="3")
            result = self.run_buildkit_starter(environment)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn(
                "BuildKit worker did not become ready after 3 probes",
                result.stderr)
            self.assertIn("fixture worker is not ready", result.stderr)
            self.assertIn("fixture daemon listening", result.stderr)

    def test_starter_keeps_privileged_launch_files_writable(self):
        with tempfile.TemporaryDirectory() as temporary:
            result = self.run_ownership_handoff_starter(temporary)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertNotIn("BuildKit daemon launch command failed", result.stderr)
            self.assertNotIn("Permission denied", result.stderr)
            self.assertIn("fixture daemon crossed privilege boundary", result.stderr)
