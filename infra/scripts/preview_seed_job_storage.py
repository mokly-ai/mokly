"""Stage opaque capture files and collect or remove trusted seed-run objects."""

import os
from pathlib import Path
import stat
import tempfile

from preview_lifecycle_core import BUCKET, PROJECT, preview_parts, run_command
from preview_lifecycle_gcp import REMOVAL_BATCH, list_objects, remove_batch
from preview_seed_types import SeedError, atomic_json


def catalogue_files(directory):
    """Inspect names and file kinds only; never parse a PR's captured bytes."""
    try:
        plan = directory / "plan.tar.gz"
        blobs = directory / "blobs"
        if not stat.S_ISDIR(blobs.lstat().st_mode):
            raise SeedError("catalogue blobs must be a directory")
        files = [(plan, "plan.tar.gz")]
        files.extend((path, "blobs/" + path.name) for path in sorted(blobs.iterdir()))
        for path, _ in files:
            if not stat.S_ISREG(path.lstat().st_mode):
                raise SeedError("catalogue inputs must be regular files")
        return files
    except OSError as error:
        raise SeedError("catalogue plan and blobs are unavailable") from error


def run_prefix(settings, run):
    return f"{preview_parts(settings.environment)[2]}/seed/{run}"


def copy(source, destination):
    run_command([
        "gcloud", "storage", "cp", str(source), str(destination),
        f"--project={PROJECT}", "--quiet",
    ])


def stage(settings, run, files):
    destination = f"gs://{BUCKET}/{run_prefix(settings, run)}"
    with tempfile.TemporaryDirectory(prefix="mkc-preview-seed-request-") as temporary:
        request = Path(temporary) / "request.json"
        atomic_json(request, {
            "schemaVersion": 1,
            "environment": settings.environment,
            "revision": settings.revision,
            "pullRequest": settings.pull_request,
        })
        copy(request, destination + "/request.json")
    if files:
        run_command([
            "gcloud", "storage", "cp", "--recursive",
            str(settings.catalogue / "plan.tar.gz"), str(settings.catalogue / "blobs"),
            destination + "/catalogue/", f"--project={PROJECT}", "--quiet",
        ])


def collect(settings, run):
    """Use the exact CLI listing absence result before downloading evidence."""
    prefix = run_prefix(settings, run)
    urls = list_objects(BUCKET, prefix)
    by_url = {url.split("#", 1)[0]: url for url in urls}
    for name, path in (
        ("seed-status.json", settings.status_file),
        ("seed-proof.json", settings.proof_file),
    ):
        url = by_url.get(f"gs://{BUCKET}/{prefix}/{name}")
        if url is None:
            continue
        descriptor, temporary = tempfile.mkstemp(dir=path.parent)
        os.close(descriptor)
        try:
            copy(url, temporary)
            os.replace(temporary, path)
        finally:
            Path(temporary).unlink(missing_ok=True)


def remove_earlier_runs(settings, run):
    seed_prefix = preview_parts(settings.environment)[2] + "/seed"
    current = f"gs://{BUCKET}/{run_prefix(settings, run)}/"
    earlier = [
        url for url in list_objects(BUCKET, seed_prefix)
        if not url.startswith(current)
    ]
    for offset in range(0, len(earlier), REMOVAL_BATCH):
        remove_batch(earlier[offset:offset + REMOVAL_BATCH])
