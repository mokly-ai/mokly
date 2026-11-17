"""Run trusted seed Job scripts with stateful provider command doubles."""

import json
import subprocess
import sys

from preview_lifecycle_support import LifecycleDouble
from support import ROOT


RUN = "123-2"
PREFIX = f"pr-42/seed/{RUN}"
JOB = f"preview-seed-{RUN}"
NO_STATUS = (
    "The seed wrote no status. If this revision predates the API preview seed, "
    "merge main into the pull request and rerun the workflow.\n"
)
LOG_STDOUT = "::error::untrusted seed stdout\npartial stdout"
LOG_STDERR = "\n::warning::untrusted seed stderr\npartial stderr"


def evidence(project="seeded"):
    status = {
        "schemaVersion": 1,
        "environment": "preview-pr-42",
        "revision": "a" * 40,
        "signIn": "accepted",
        "project": project,
        "checkedAt": "2026-10-30T12:00:00Z",
    }
    proof = {
        "schemaVersion": 1,
        "environment": "preview-pr-42",
        "revision": "a" * 40,
        "workspaceSlug": "mokly-ai",
        "projectSlug": "mokly-cloud",
        "projectId": "0199a000-0000-7000-8000-000000000002",
        "publicationId": "0199a000-0000-7000-8000-000000000004",
        "publicationState": "ready",
        "pullRequest": 42,
        "viewerUrl": "https://pr-42.preview.example.com/mokly-ai/mokly-cloud/pull-requests/42",
        "uploadStatus": 201,
        "checkedAt": "2026-10-30T12:00:00Z",
    }
    return status, proof


class SeedJobDouble(LifecycleDouble):
    """Extend lifecycle commands with seed Jobs and a local object bucket."""

    def __init__(self, directory):
        super().__init__(directory)
        self.workspace = self.directory / "workspace"
        self.workspace.mkdir()
        (self.workspace / "infra").symlink_to(ROOT / "infra", target_is_directory=True)
        self.context = self.workspace / ".context"
        self.context.mkdir()
        self.objects = self.state / "objects"
        self.objects.mkdir()
        self.put("pr-42/seed/122-1/request.json", b"old run")
        self.put("pr-42/sha256/keep", b"keep publication")

    def put(self, name, body):
        target = self.objects / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        return target

    def environment(self, deploy=True, **overrides):
        return super().environment(
            deploy,
            SEED_JOB_DOUBLE="true",
            SEED_JOB_COMMAND=str(ROOT / "infra/tests/preview_seed_job_double.py"),
            **overrides,
        )

    def run_seed(self, arguments=None, **overrides):
        return subprocess.run(
            [sys.executable, str(ROOT / "infra/scripts/preview-seed-job.py"),
             "preview-pr-42", *(arguments or ["--run", RUN])],
            cwd=self.workspace,
            env=self.environment(**overrides),
            capture_output=True,
            text=True,
            timeout=30,
        )

    def write_evidence(self, project="seeded"):
        for name, value in zip(("seed-status.json", "seed-proof.json"), evidence(project)):
            (self.context / name).write_text(json.dumps(value))

    def read_evidence(self, name):
        return json.loads((self.context / name).read_text())

    def catalogue(self, blob_count=1):
        catalogue = self.workspace / "catalogue"
        (catalogue / "blobs").mkdir(parents=True)
        (catalogue / "plan.tar.gz").write_bytes(b"\x00opaque untrusted archive\xff")
        (catalogue / "blobs" / ("b" * 64)).write_bytes(b"\xffuntrusted blob\x00")
        for index in range(1, blob_count):
            (catalogue / "blobs" / f"{index:064x}").write_bytes(b"\x00blob\xff" + bytes([index]))
        return catalogue
