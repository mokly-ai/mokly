#!/usr/bin/env python3
"""Wait until the Foundation workflow run of this commit succeeds on main."""

import json
import os
import re
import subprocess
import sys
import time


WORKFLOW = "foundation.yml"
# A re-run keeps its commit, so a re-run of an older commit applies older code.
NEWEST_ONLY = (
    "Act only when this commit is still the newest on main. "
    "The runs of a newer commit carry this change."
)
FIELDS = "attempt,conclusion,createdAt,databaseId,event,headBranch,headSha,number,status,url"
INTERVAL_SECONDS = 30
REGISTRATION_SECONDS = 5 * 60
TIMEOUT_SECONDS = 120 * 60


def list_runs(sha, repository, run=subprocess.run):
    """Return the Foundation runs of the commit on main, newest number first."""
    result = run(
        ["gh", "run", "list", "--repo", repository, "--workflow", WORKFLOW,
         "--branch", "main", "--commit", sha, "--limit", "100", "--json", FIELDS],
        capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        raise LookupError(result.stderr.strip() or f"gh exited with status {result.returncode}")
    try:
        runs = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise LookupError(f"gh returned invalid JSON: {error}") from error
    if not isinstance(runs, list) or not all(_valid(entry) for entry in runs):
        raise LookupError("gh returned an unexpected run list")
    return sorted(
        (entry for entry in runs if entry["headSha"] == sha),
        key=lambda entry: entry["number"], reverse=True,
    )


def decide(sha, runs):
    """Return pass, fail or wait and a message for the commit's Foundation runs."""
    waiting = [entry for entry in runs if entry["status"] != "completed"]
    if waiting:
        run = waiting[0]
        return "wait", f"Waiting for Foundation run {run['url']} of {sha}: {run['status']}."
    newest = runs[0]
    if newest["conclusion"] == "success":
        return "pass", f"Foundation run {newest['url']} succeeded for {sha}."
    conclusion = newest["conclusion"] or "without a conclusion"
    return "fail", (
        f"Foundation run {newest['url']} concluded {conclusion} for {sha}.\n"
        f"{NEWEST_ONLY}\n"
        "Correct the cause, use Re-run all jobs on that run, then re-run this Deploy run."
    )


def wait(sha, repository, lookup=list_runs, sleep=time.sleep):
    """Poll until the newest Foundation run of the commit completes; return the exit status."""
    polls = TIMEOUT_SECONDS // INTERVAL_SECONDS + 1
    registration_polls = REGISTRATION_SECONDS // INTERVAL_SECONDS + 1
    found = False
    error = None
    for poll in range(1, polls + 1):
        try:
            runs = lookup(sha, repository)
        except LookupError as failure:
            error = str(failure)
            print(f"Could not list Foundation runs: {error}", file=sys.stderr)
        else:
            error = None
            found = found or bool(runs)
            if runs:
                state, message = decide(sha, runs)
                if state != "wait":
                    print(message, file=sys.stdout if state == "pass" else sys.stderr)
                    return 0 if state == "pass" else 1
                print(message)
        if not found and poll >= registration_polls:
            minutes = REGISTRATION_SECONDS // 60
            print(f"No Foundation run of {sha} appeared within {minutes} minutes.", file=sys.stderr)
            if error:
                print(f"The last run lookup failed: {error}", file=sys.stderr)
            print(NEWEST_ONLY, file=sys.stderr)
            print("Check that the Foundation workflow is enabled, dispatch it from main, then "
                  "re-run this Deploy run.", file=sys.stderr)
            return 1
        if poll < polls:
            sleep(INTERVAL_SECONDS)
    print(f"The Foundation run of {sha} did not finish within {TIMEOUT_SECONDS // 60} minutes.",
          file=sys.stderr)
    print(NEWEST_ONLY, file=sys.stderr)
    print("Re-run this Deploy run after that run finishes.", file=sys.stderr)
    return 1


def _valid(entry):
    return (
        isinstance(entry, dict)
        and isinstance(entry.get("headSha"), str)
        and isinstance(entry.get("status"), str)
        and isinstance(entry.get("conclusion"), str)
        and isinstance(entry.get("url"), str)
        and type(entry.get("number")) is int
    )


def main():
    sha = os.environ.get("GITHUB_SHA", "")
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha) or not re.fullmatch(r"[\w.-]+/[\w.-]+", repository):
        print("GITHUB_SHA and GITHUB_REPOSITORY must name the commit and repository",
              file=sys.stderr)
        return 1
    return wait(sha, repository)


if __name__ == "__main__":
    raise SystemExit(main())
