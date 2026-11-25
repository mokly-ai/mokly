#!/usr/bin/env python3
"""Print a validated preview PR comment from trusted workflow inputs."""

import argparse
import re
import sys
from pathlib import Path

from preview_lifecycle_core import preview_parts
from preview_seed_types import SeedError, read_json


def seed_outcome(path, environment, revision):
    if path is None:
        return None
    value = read_json(path)
    if set(value) != {
        "schemaVersion", "environment", "revision", "signIn", "project", "checkedAt"
    }:
        raise ValueError("seed status has unexpected fields")
    if (
        value["schemaVersion"] != 1
        or value["environment"] != environment
        or value["revision"] != revision
        or value["signIn"] not in ("accepted", "unsupported", "refused")
        or value["project"] not in ("seeded", "failed")
    ):
        raise ValueError("seed status does not match this preview")
    return value


def proof_present(path):
    if path is None:
        return False
    try:
        return Path(path).is_file() and Path(path).stat().st_size > 0
    except OSError as error:
        raise ValueError("seed proof is unavailable") from error


def comment(
    state,
    environment,
    revision,
    domain,
    catalogue,
    run_url,
    seed_status=None,
    seed_proof=None,
):
    number, _namespace, _prefix = preview_parts(environment)
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("invalid tested SHA")
    label = r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
    if not all(re.fullmatch(label + r"(?:\." + label + r")+", name) for name in (domain, catalogue)):
        raise ValueError("invalid preview domains")
    if not re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[1-9][0-9]*", run_url):
        raise ValueError("invalid workflow evidence URL")
    app = f"https://pr-{number}.preview.{domain}"
    api = f"https://pr-{number}.preview.api.{domain}"
    messages = {
        "running": "Checks running",
        "failed": "Checks failed. Open the run for details.",
        "success": "Checks passed",
        "removed": "Preview removed",
        "cleanup-failed": "Cleanup failed. Rerun the workflow.",
    }
    if state not in messages:
        raise ValueError("invalid preview comment state")
    status = seed_outcome(seed_status, environment, revision)
    has_proof = proof_present(seed_proof)
    if state in ("running", "removed", "cleanup-failed") and (status is not None or has_proof):
        raise ValueError("this comment state cannot carry seed inputs")
    if state == "success" and (
        status is None
        or status["signIn"] != "accepted"
        or status["project"] != "seeded"
        or not has_proof
    ):
        raise ValueError("successful comments require accepted seed evidence")
    lines = ["<!-- mokly-preview -->", "### Mokly preview", "", f"Status: **{messages[state]}**",
             f"- Commit: `{revision}`", f"- App: {app}/sign-in", f"- API: {api}",
             f"- Catalogue: `https://p-<publication-id>.pr-{number}.preview.{catalogue}`",
             f"- Workflow evidence: {run_url}"]
    if state == "success" and has_proof:
        lines.append(
            f"- Sample project: {app}/mokly-ai/mokly/pull-requests/{number}"
        )
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", required=True, choices=("running", "failed", "success", "removed", "cleanup-failed"))
    parser.add_argument("--environment", required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--catalogue-domain", required=True)
    parser.add_argument("--run-url", required=True)
    parser.add_argument("--seed-status")
    parser.add_argument("--seed-proof")
    args = parser.parse_args()
    print(comment(args.state, args.environment, args.revision, args.domain,
                  args.catalogue_domain, args.run_url, args.seed_status, args.seed_proof), end="")


if __name__ == "__main__":
    try:
        main()
    except (SeedError, ValueError, KeyError, TypeError, OSError) as error:
        print(f"Preview comment: {error}", file=sys.stderr)
        sys.exit(1)
