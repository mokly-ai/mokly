"""Real bounded storage comparison for BuildKit OCI snapshotters.

Builds identical payload and metadata layers once with the ``auto``
snapshotter and once with ``native`` on disposable bounded ext4 filesystems,
and requires the layered selection to use less allocated BuildKit-root
storage. The local measurement never infers hosted-runner capacity.
"""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import unittest

from support import ROOT


IMAGE_BYTES = 256 * 1024 * 1024
PAYLOAD_BYTES = 8 * 1024 * 1024
BUILDKIT_TOOLS = ("buildctl", "buildkit-runc", "buildkitd")
STORAGE_TOOLS = ("mkfs.ext4", "mount", "sudo", "umount")


@unittest.skipUnless(
    all(shutil.which(tool) for tool in BUILDKIT_TOOLS),
    "real BuildKit tools unavailable",
)
class BuildkitStorageTests(unittest.TestCase):
    def setUp(self):
        missing = [tool for tool in STORAGE_TOOLS if not shutil.which(tool)]
        self.assertEqual(
            missing, [],
            "BuildKit storage smoke requires e2fsprogs, mount, umount and sudo")
        sudo = shutil.which("sudo")
        result = subprocess.run(
            [sudo, "-n", "true"], capture_output=True, timeout=5)
        if result.returncode:
            self.skipTest("passwordless sudo unavailable")

    def root_usage(self, root):
        result = subprocess.run(
            ["sudo", "-n", "du", "-s", "--block-size=1", str(root)],
            check=True, capture_output=True, text=True, timeout=10)
        return int(result.stdout.split()[0])

    def launch_daemon(self, root, socket, log, snapshotter):
        command = [
            "sudo", "-n", "sh", "-c",
            'log=$1; shift; nohup "$@" >"$log" 2>&1 & printf "%s\\n" "$!"',
            "sh", str(log), shutil.which("buildkitd"), "--root", str(root),
            "--addr", "unix://" + str(socket), "--containerd-worker=false",
            "--oci-worker=true", "--oci-worker-binary",
            shutil.which("buildkit-runc"), "--oci-worker-gc=false",
            "--oci-worker-net=host", "--oci-worker-snapshotter=" + snapshotter,
        ]
        result = subprocess.run(
            command, check=True, capture_output=True, text=True, timeout=5)
        return int(result.stdout.strip())

    def wait_for_worker(self, socket, log):
        address = "unix://" + str(socket)
        deadline = time.monotonic() + 15
        last_probe = "worker probe did not run"
        while time.monotonic() < deadline:
            if socket.exists():
                subprocess.run(
                    ["sudo", "-n", "chown", f"{os.getuid()}:{os.getgid()}",
                     str(socket)], check=True, timeout=5)
                try:
                    result = subprocess.run(
                        ["buildctl", "--addr", address, "debug", "workers",
                         "--verbose"], capture_output=True, text=True, timeout=3)
                except subprocess.TimeoutExpired:
                    last_probe = "worker probe exceeded three seconds"
                else:
                    last_probe = result.stdout + result.stderr
                    if result.returncode == 0:
                        return result.stdout
            time.sleep(0.1)
        daemon_log = log.read_text() if log.exists() else "<missing>"
        self.fail(f"{last_probe}\nBuildKit daemon log:\n{daemon_log}")

    def stop_daemon(self, pid):
        subprocess.run(
            ["sudo", "-n", "kill", str(pid)], capture_output=True, timeout=5)
        for _ in range(30):
            result = subprocess.run(
                ["sudo", "-n", "kill", "-0", str(pid)], capture_output=True,
                timeout=5)
            if result.returncode:
                return
            time.sleep(0.1)
        subprocess.run(
            ["sudo", "-n", "kill", "-KILL", str(pid)], check=True, timeout=5)

    def measure_snapshotter(self, temporary, context, snapshotter):
        disk = Path(temporary, snapshotter + ".ext4")
        mountpoint = Path(temporary, snapshotter + "-mount")
        socket = Path(temporary, snapshotter + ".sock")
        log = Path(temporary, snapshotter + ".log")
        output = Path(temporary, snapshotter + ".tar")
        with disk.open("wb") as disk_file:
            disk_file.truncate(IMAGE_BYTES)
        mountpoint.mkdir()
        subprocess.run(
            ["sudo", "-n", "mkfs.ext4", "-q", "-F", str(disk)],
            check=True, timeout=20)
        subprocess.run(
            ["sudo", "-n", "mount", "-o", "loop", str(disk), str(mountpoint)],
            check=True, timeout=10)
        pid = None
        try:
            root = mountpoint / "buildkit"
            pid = self.launch_daemon(root, socket, log, snapshotter)
            workers = self.wait_for_worker(socket, log)
            selected = next(
                line.rsplit(maxsplit=1)[-1]
                for line in workers.splitlines()
                if "worker.snapshotter:" in line
            )
            before = self.root_usage(root)
            result = subprocess.run(
                [
                    "buildctl", "--addr", "unix://" + str(socket), "build",
                    "--frontend", "dockerfile.v0", "--local", "context=" + str(context),
                    "--local", "dockerfile=" + str(context), "--opt",
                    "filename=Dockerfile", "--output", "type=oci,dest=" + str(output),
                ], cwd=ROOT, capture_output=True, text=True, timeout=90)
            self.assertEqual(
                result.returncode, 0,
                result.stdout + result.stderr + "\n" + log.read_text())
            return self.root_usage(root) - before, selected
        finally:
            if pid is not None:
                self.stop_daemon(pid)
            subprocess.run(
                ["sudo", "-n", "umount", str(mountpoint)], check=True, timeout=10)

    def test_native_parent_copies_use_more_bounded_storage_than_auto(self):
        scratch = ROOT / ".context"
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix="buildkit-storage-", dir=scratch,
        ) as temporary:
            context = Path(temporary, "context")
            context.mkdir()
            payload = b"capacity-smoke\n"
            repeats = PAYLOAD_BYTES // len(payload) + 1
            Path(context, "payload.bin").write_bytes((payload * repeats)[:PAYLOAD_BYTES])
            Path(context, "Dockerfile").write_text(
                "FROM scratch\n"
                "COPY payload.bin /payload.bin\n"
                "WORKDIR /one\n"
                "WORKDIR /two\n"
                "WORKDIR /three\n"
                "WORKDIR /four\n"
            )
            auto_growth, auto_selected = self.measure_snapshotter(
                temporary, context, "auto")
            native_growth, native_selected = self.measure_snapshotter(
                temporary, context, "native")

            print(
                "BuildKit bounded storage smoke: "
                f"auto={auto_selected}/{auto_growth} bytes, "
                f"native={native_selected}/{native_growth} bytes",
                flush=True,
            )
            self.assertIn(auto_selected, ("overlayfs", "fuse-overlayfs"))
            self.assertEqual(native_selected, "native")
            self.assertGreater(native_growth, auto_growth + 2 * PAYLOAD_BYTES)


if __name__ == "__main__":
    unittest.main()
