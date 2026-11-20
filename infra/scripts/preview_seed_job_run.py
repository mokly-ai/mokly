"""Run a seed Job and attempt every evidence and cleanup step on failure."""

import json
import math
import sys

from preview_lifecycle_core import CommandFailure
from preview_seed_job_storage import collect, remove_earlier_runs, stage
from preview_seed_types import SeedError, read_json


class NoSeedStatus(SeedError):
    """A failed API command gave no evidence usable by the trusted release."""

    def __init__(self):
        super().__init__(
            "The seed wrote no status. If this revision predates the API preview seed, "
            "merge main into the pull request and rerun the workflow."
        )


def create_job(cluster, job, run):
    try:
        template = json.loads(cluster.kubectl([
            "create", "job", job, "--from=cronjob/preview-seed",
            "--dry-run=client", "-o", "json",
        ]))
        containers = template["spec"]["template"]["spec"]["containers"]
        if len(containers) != 1 or containers[0].get("args") != ["preview-seed"]:
            raise SeedError("preview-seed template must run one API seed container")
        containers[0]["args"].extend(["--run", run])
    except (AttributeError, IndexError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise SeedError("preview-seed template is malformed") from error
    cluster.kubectl(["create", "-f", "-"], stdin=json.dumps(template))


def wait_for_job(cluster, job, clock, sleeper):
    deadline = clock() + 1500
    while True:
        remaining = deadline - clock()
        if remaining <= 0:
            raise SeedError("seed Job did not finish within 25 minutes")
        try:
            value = json.loads(cluster.kubectl([
                "get", "job", job, "-o", "json",
                f"--request-timeout={min(10, math.ceil(remaining))}s",
            ], timeout=min(15, remaining)))
            conditions = value.get("status", {}).get("conditions", [])
            for condition in conditions:
                if condition.get("status") == "True" and condition.get("type") in ("Complete", "Failed"):
                    return condition["type"]
        except (AttributeError, TypeError, json.JSONDecodeError) as error:
            raise SeedError("seed Job status is malformed") from error
        remaining = deadline - clock()
        if remaining > 0:
            sleeper(min(5, remaining))


def run_seed_job(settings, run, files, cluster, clock, sleeper):
    job = "preview-seed-" + run
    for path in (settings.status_file, settings.proof_file):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.unlink(missing_ok=True)
    failures = []
    outcome = None
    evidence_collected = False

    def collect_evidence():
        nonlocal evidence_collected
        collect(settings, run)
        evidence_collected = True

    try:
        stage(settings, run, files)
        create_job(cluster, job, run)
        outcome = wait_for_job(cluster, job, clock, sleeper)
    except (CommandFailure, OSError, ValueError) as error:
        failures.append(str(error))
    finally:
        actions = (
            lambda: cluster.kubectl([
                "logs", "job/" + job, "--all-containers=true", "--timestamps=true",
                "--request-timeout=30s",
            ], job_logs=True),
            collect_evidence,
            lambda: cluster.kubectl([
                "delete", "job", job, "--ignore-not-found", "--cascade=foreground",
                "--wait=true", "--timeout=120s",
            ], timeout=130),
            lambda: remove_earlier_runs(settings, run),
        )
        for action in actions:
            try:
                action()
            except (CommandFailure, OSError, ValueError) as error:
                failures.append(str(error))
    if outcome == "Failed" and evidence_collected and not settings.status_file.exists():
        for failure in failures:
            print(f"Preview seed failed: {failure}", file=sys.stderr)
        raise NoSeedStatus()
    if settings.status_file.exists():
        if read_json(settings.status_file).get("project") != "seeded":
            failures.append("seed status reports project failed")
    else:
        failures.append("seed status is missing")
    if outcome == "Failed":
        failures.append("seed Job failed")
    if failures:
        raise SeedError("; ".join(failures))
