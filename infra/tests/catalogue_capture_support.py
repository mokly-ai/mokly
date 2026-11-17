"""Git checkout, export and recorded-CLI harness for catalogue capture tests."""

import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

from support import ROOT


FIXTURES = ROOT / "infra/tests/fixtures/catalogue-capture"
SCRIPT = ROOT / "infra/scripts/capture-catalogue.py"
INDEX = "mokly-viewer/index.json"
GZIP_CHUNK_BYTES = 1024 * 1024
ENVELOPE = "mokly-upload.json"
MARKER = ".mokly-export-artifact"


def marker_bytes(files, declared=()):
    """Render a schema 3 ownership marker the way the exporter writes it."""
    entries = [
        {"path": name, "sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}
        for name, data in files.items()
    ]
    entries.extend(
        {"path": path, "sha256": digest, "size": size} for path, digest, size in declared
    )
    entries.sort(key=lambda entry: entry["path"])
    marker = {"schemaVersion": 3, "files": entries}
    return (json.dumps(marker, indent=2) + "\n").encode()


class EofGuard:
    """Expose zlib state while refusing decompression after member EOF."""

    def __init__(self, decompressor):
        self.decompressor = decompressor

    @property
    def eof(self):
        return self.decompressor.eof

    @property
    def unconsumed_tail(self):
        return self.decompressor.unconsumed_tail

    @property
    def unused_data(self):
        return self.decompressor.unused_data

    def decompress(self, data, max_length):
        if self.decompressor.eof:
            raise AssertionError("decompress called after gzip member EOF")
        return self.decompressor.decompress(data, max_length)


def pad_gzip_to_chunk_boundary(member):
    """Extend one real gzip header so its member ends on a read boundary."""
    missing = -len(member) % GZIP_CHUNK_BYTES
    padding = missing - 2
    if not 0 <= padding <= 65535 or member[:3] != b"\x1f\x8b\x08":
        raise AssertionError("gzip fixture cannot be padded to one chunk boundary")
    flags = member[3]
    if flags & 4:
        raise AssertionError("gzip fixture already has an extra field")
    return (
        member[:3]
        + bytes([flags | 4])
        + member[4:10]
        + padding.to_bytes(2, "little")
        + bytes(padding)
        + member[10:]
    )


class CaptureHarness:
    """Create a complete checkout and drive the command through its real HTTP server."""

    def __init__(self, root):
        self.root = Path(root)
        self.checkout = self.root / "source"
        self.checkout.mkdir()
        self.observation = self.root / "observation.json"
        self.bearer = self.root / "bearer.txt"
        self.npm_calls = self.root / "npm-calls"
        self.output = self.root / ".context/seed/catalogue"
        self._git("init", "-q", "-b", "feature")
        self._git("config", "user.email", "test@example.invalid")
        self._git("config", "user.name", "Capture Test")
        (self.checkout / "mokly.config.json").write_text("{}\n")
        executable = self.checkout / "node_modules/.bin/mokly"
        executable.parent.mkdir(parents=True)
        shutil.copyfile(FIXTURES / "mokly-double.py", executable)
        executable.chmod(0o755)
        self._git("add", ".")
        self._git("commit", "-qm", "fixture")
        self.revision = self._git("rev-parse", "HEAD").stdout.strip()
        self._git("update-ref", "refs/remotes/origin/main", self.revision)
        commands = self.root / "commands"
        commands.mkdir()
        npm = commands / "npm"
        npm.write_text(
            "#!/usr/bin/env bash\n"
            "set -euo pipefail\n"
            "printf '%s\\n' \"$*\" > \"$MKC_CAPTURE_TEST_NPM\"\n"
        )
        npm.chmod(0o755)
        self.path = str(commands) + ":" + os.environ["PATH"]
        self.export_index = 0

    def _git(self, *arguments):
        return subprocess.run(
            ["git", "-C", str(self.checkout), *arguments],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )

    def envelope(self, **changes):
        value = {
            "schemaVersion": 3,
            "moklyVersion": "0.18.0",
            "repository": {
                "host": "github.com",
                "owner": "mokly-ai",
                "name": "mokly-cloud",
            },
            "branch": "feature/catalogue",
            "headSha": self.revision,
            "baseRef": "origin/main",
            "baseSha": self.revision,
            "pullRequest": 42,
            "configPath": "mokly.config.json",
            "exportedAt": "2026-09-27T00:00:00.000Z",
        }
        value.update(changes)
        return value

    def export(self, envelope, page=b"<!doctype html>", index=None, declared=()):
        """Write a finalized export whose marker may declare extra unwritten files."""
        self.export_index += 1
        directory = self.root / f"export-{self.export_index}"
        files = {
            ENVELOPE: (json.dumps(envelope, indent=2) + "\n").encode(),
            "index.html": page,
            "404.html": b"<!doctype html><title>Not found</title>",
            "static/copy.html": page,
        }
        files[INDEX] = index if index is not None else json.dumps({
            "schemaVersion": 9, "base": envelope["baseRef"],
            "baseCommit": envelope["baseSha"], "changesStatus": "ready",
            "comparisonUrl": "mokly-viewer/diffs/generations/" + "c" * 64 + "/",
            "screens": [], "components": [], "documents": [], "pages": [],
            "useCases": [], "removedEntries": [],
        }).encode()
        for name, data in files.items():
            path = directory / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        (directory / MARKER).write_bytes(marker_bytes(files, declared))
        return directory

    def plan(self, export):
        """Pack the CLI's plan archive: envelope, marker, then the index."""
        names = [ENVELOPE, MARKER, INDEX]
        path = self.root / f"plan-{self.export_index}.tar.gz"
        with tarfile.open(path, "w:gz") as archive:
            for name in names:
                data = (export / name).read_bytes()
                item = tarfile.TarInfo(name)
                item.size = len(data)
                item.mtime = 0
                archive.addfile(item, io.BytesIO(data))
        return path

    def run(
        self,
        export,
        plan=None,
        *,
        mode="success",
        local=False,
        debug_timings=False,
        environment="preview-pr-42",
        branch="feature/catalogue",
        revision=None,
        timeout=30,
    ):
        self.observation.unlink(missing_ok=True)
        self.bearer.unlink(missing_ok=True)
        self.npm_calls.unlink(missing_ok=True)
        command = [sys.executable, str(SCRIPT)]
        if local:
            command.extend(["--local", "--checkout", str(self.checkout)])
        else:
            command.extend(
                [environment, "--checkout", str(self.checkout), "--branch", branch]
            )
        if debug_timings:
            command.append("--debug-timings")
        variables = dict(
            os.environ,
            PATH=self.path,
            MKC_REVISION=revision if revision is not None else self.revision,
            MKC_CAPTURE_FIXTURES=str(FIXTURES),
            MKC_CAPTURE_TEST_EXPORT=str(export),
            MKC_CAPTURE_TEST_PLAN=str(plan or self.plan(export)),
            MKC_CAPTURE_TEST_MODE=mode,
            MKC_CAPTURE_TEST_OBSERVATION=str(self.observation),
            MKC_CAPTURE_TEST_BEARER=str(self.bearer),
            MKC_CAPTURE_TEST_NPM=str(self.npm_calls),
            GITHUB_ACTIONS="untrusted-parent-value",
            GITHUB_HEAD_REF="untrusted-parent-value",
            GITHUB_REF="untrusted-parent-value",
        )
        return subprocess.run(
            command,
            cwd=self.root,
            env=variables,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

    def observed(self):
        return json.loads(self.observation.read_text())

    def stored_blobs(self):
        """Return the captured blob file names, or an empty set without a capture."""
        blobs = self.output / "blobs"
        return {path.name for path in blobs.iterdir()} if blobs.is_dir() else set()

    @staticmethod
    def expected_blobs(export):
        """Every distinct export hash except the plan archive's own files."""
        digests = {
            path.relative_to(export).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in export.rglob("*")
            if path.is_file() and path.name != MARKER
        }
        own = {digests[ENVELOPE], digests[INDEX]}
        return set(digests.values()) - own
