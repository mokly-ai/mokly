"""Executable gcloud and kubectl doubles with real command response shapes."""

import json
import os
from pathlib import Path
import shutil
import sys

from preview_seed_job_support import LOG_STDERR, LOG_STDOUT, evidence


STATE = Path(os.environ["DOUBLE_STATE"])
OBJECTS = STATE / "objects"
BUCKET = "mokly-508518-preview-blobs"


def object_path(url):
    return OBJECTS / url.split("#", 1)[0].removeprefix(f"gs://{BUCKET}/")


def storage(arguments):
    command = arguments[1]
    if command == "cp":
        paths = [argument for argument in arguments[2:] if not argument.startswith("--")]
        *sources, destination_url = paths
        folder = len(sources) > 1 or destination_url.endswith("/")
        destination = object_path(destination_url) if destination_url.startswith("gs://") else Path(destination_url)
        for source_url in sources:
            source = object_path(source_url) if source_url.startswith("gs://") else Path(source_url)
            files = sorted(path for path in source.rglob("*") if path.is_file()) if source.is_dir() else [source]
            if source.is_dir() and "--recursive" not in arguments:
                return 91
            for path in files:
                relative = path.relative_to(source.parent) if source.is_dir() else Path(source.name)
                target = destination / relative if folder else destination
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, target)
                source_display = source_url if source_url.startswith("gs://") else path.resolve().as_uri()
                target_display = (
                    destination_url.rstrip("/") + "/" + relative.as_posix() if folder else destination_url
                ) if destination_url.startswith("gs://") else target.resolve().as_uri()
                print(f"Copying {source_display} to {target_display}", file=sys.stderr)
        return 0
    if command == "ls":
        url = next(argument for argument in arguments if argument.startswith("gs://"))
        if os.environ.get("SEED_READ_DENIED") == "true" and "/seed/123-2/**" in url:
            print("ERROR: (gcloud.storage.ls) HTTPError 403: Permission denied.", file=sys.stderr)
            return 1
        prefix = object_path(url.removesuffix("/**"))
        paths = sorted(path for path in prefix.rglob("*") if path.is_file())
        if not paths:
            fixture = Path(os.environ["LIFECYCLE_FIXTURES"]) / "gcloud-storage-no-objects.stderr.txt"
            print(fixture.read_text(), file=sys.stderr, end="")
            return 1
        print(json.dumps([
            {"type": "cloud_object", "url": f"gs://{BUCKET}/{path.relative_to(OBJECTS)}#1",
             "metadata": {"bucket": BUCKET, "name": str(path.relative_to(OBJECTS))}}
            for path in paths
        ]))
        return 0
    if command == "rm":
        for url in sys.stdin.read().splitlines():
            object_path(url).unlink()
        print("Removing objects:\n...", file=sys.stderr)
        return 0
    return 91


def kubectl(arguments):
    while arguments and arguments[0] in ("--kubeconfig", "--context", "--namespace"):
        option, value, *arguments = arguments
        if option == "--kubeconfig" and (
            value != os.environ.get("KUBECONFIG") or not Path(value).is_file()
        ):
            return 94
        if option == "--context" and value != "gke_mokly-508518_us-central1_mkc-autopilot":
            return 94
    if arguments[:2] == ["create", "job"]:
        print(json.dumps({
            "apiVersion": "batch/v1", "kind": "Job", "metadata": {"name": arguments[2]},
            "spec": {"template": {"spec": {"containers": [{"name": "api", "args": ["preview-seed"]}]}}},
        }))
        return 0
    if arguments[:2] == ["create", "-f"]:
        value = json.load(sys.stdin)
        (STATE / "created-job.json").write_text(json.dumps(value))
        (STATE / "job").touch()
        print(f"job.batch/{value['metadata']['name']} created")
        return 0
    if arguments[:2] == ["get", "job"]:
        scenario = os.environ.get("SEED_SCENARIO", "seeded")
        run = arguments[2].removeprefix("preview-seed-")
        if scenario != "pending" and scenario != "no-status":
            status, proof = evidence("seeded" if scenario == "seeded" else "failed")
            folder = OBJECTS / f"pr-42/seed/{run}"
            (folder / "seed-status.json").write_text(json.dumps(status))
            if scenario == "seeded":
                (folder / "seed-proof.json").write_text(json.dumps(proof))
        condition = "Complete" if scenario == "seeded" else "Failed"
        conditions = [] if scenario == "pending" else [{"type": condition, "status": "True"}]
        print(json.dumps({"status": {"conditions": conditions}}))
        return 0
    if arguments and arguments[0] == "logs":
        mode = os.environ.get("SEED_LOG_MODE")
        if mode in ("commands", "partial-failure"):
            print(LOG_STDOUT, end="", flush=True)
            print(LOG_STDERR, file=sys.stderr, end="", flush=True)
            return 1 if mode == "partial-failure" else 0
        print("preview seed account accepted\npreview seed catalogue missing")
        return 0
    if arguments[:2] == ["delete", "job"]:
        (STATE / "job").unlink(missing_ok=True)
        print(f'job.batch "{arguments[2]}" deleted')
        return 0
    return 93


if __name__ == "__main__":
    provider, *values = sys.argv[1:]
    raise SystemExit(storage(values) if provider == "gcloud" else kubectl(values))
