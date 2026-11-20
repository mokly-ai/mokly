#!/usr/bin/env python3
"""Capture and validate the catalogue upload exchange of one PR checkout."""

import argparse
from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
from typing import Optional
import unicodedata

from catalogue_capture_endpoint import CaptureEndpoint, EndpointError
from catalogue_capture_plan import PlanError, read_plan
from preview_lifecycle_core import PreviewInputError, preview_parts


CATALOGUE = Path(".context/seed/catalogue")
PUBLISH_TIMEOUT_SECONDS = 15 * 60


class CaptureError(ValueError):
    """A safe catalogue-capture diagnostic."""


@dataclass(frozen=True)
class CaptureSettings:
    """Validated checkout and expected upload identity."""

    checkout: Path
    revision: str
    branch: str
    pull_request: Optional[int]
    base_sha: str
    repository: str


def run_git(checkout, *arguments):
    try:
        result = subprocess.run(
            ["git", "-C", str(checkout), *arguments],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise CaptureError("could not inspect the Git checkout") from error
    if result.returncode:
        raise CaptureError("could not inspect the Git checkout")
    return result.stdout.strip()


def valid_revision(value):
    return bool(re.fullmatch(r"[a-f0-9]{40}", value))


def validate_branch(value):
    if (
        not value
        or len(value.encode("utf-8")) > 255
        or any(unicodedata.category(character) == "Cc" for character in value)
    ):
        raise CaptureError("branch must be nonempty, control-free and at most 255 bytes")
    return value


def validate_repository(value):
    parts = value.split("/")
    if len(parts) != 2 or any(
        part in (".", "..") or not re.fullmatch(r"[A-Za-z0-9_.-]{1,255}", part)
        for part in parts
    ):
        raise CaptureError("--repository must be a GitHub owner/name")
    return value


def settings(arguments, variables):
    checkout = Path(arguments.checkout).resolve()
    if not checkout.is_dir():
        raise CaptureError("checkout must be a directory")
    head = run_git(checkout, "rev-parse", "HEAD")
    if not valid_revision(head):
        raise CaptureError("checkout HEAD must be a full lowercase Git revision")
    if arguments.local:
        if arguments.environment is not None or arguments.branch is not None:
            raise CaptureError("--local does not accept an environment or --branch")
        revision = head
        branch = validate_branch(run_git(checkout, "symbolic-ref", "--short", "HEAD"))
        pull_request = None
    else:
        if arguments.environment is None or arguments.branch is None:
            raise CaptureError("preview capture requires an environment and --branch")
        number, _namespace, _prefix = preview_parts(arguments.environment)
        revision = variables.get("MKC_REVISION", "")
        if not valid_revision(revision):
            raise CaptureError("MKC_REVISION must be a full lowercase Git revision")
        if head != revision:
            raise CaptureError("checkout HEAD does not match MKC_REVISION")
        branch = validate_branch(arguments.branch)
        pull_request = int(number)
    base_sha = run_git(checkout, "merge-base", revision, "origin/main")
    if not valid_revision(base_sha):
        raise CaptureError("origin/main did not resolve to a merge base")
    return CaptureSettings(checkout, revision, branch, pull_request, base_sha,
                           validate_repository(arguments.repository))


def run_command(command, checkout, label, variables=None):
    started = time.monotonic()
    try:
        result = subprocess.run(
            command,
            cwd=checkout,
            env=variables,
            timeout=PUBLISH_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise CaptureError(f"{label} timed out after 15 minutes") from error
    except OSError as error:
        raise CaptureError(f"{label} could not start") from error
    if result.returncode:
        raise CaptureError(f"{label} failed with exit {result.returncode}")
    return time.monotonic() - started


def capture_exchange(configuration, local, directory, debug_timings=False):
    """Run the pinned CLI against one loopback exchange stored in `directory`."""
    install_seconds = None
    if not local:
        install_seconds = run_command(
            ["npm", "ci"],
            configuration.checkout,
            "npm ci",
        )
    executable = configuration.checkout / "node_modules/.bin/mokly"
    if not executable.is_file():
        raise CaptureError("the pinned Mokly CLI is not installed")
    token = secrets.token_hex(32)
    environment = dict(os.environ)
    environment["MOKLY_TOKEN"] = token
    if local:
        for name in ("GITHUB_ACTIONS", "GITHUB_HEAD_REF", "GITHUB_REF"):
            environment.pop(name, None)
    else:
        environment["GITHUB_ACTIONS"] = "true"
        environment["GITHUB_HEAD_REF"] = configuration.branch
        environment["GITHUB_REF"] = (
            f"refs/pull/{configuration.pull_request}/head"
        )
    advertise_gzip = os.environ.get("MKC_CAPTURE_ADVERTISE_GZIP") == "true"
    endpoint = CaptureEndpoint(directory, token, advertise_gzip=advertise_gzip)
    with tempfile.TemporaryDirectory(prefix="mkc-catalogue-publish-") as runtime, endpoint as url:
        temporary, cache = Path(runtime).resolve() / "tmp", Path(runtime).resolve() / "cache"
        temporary.mkdir()
        cache.mkdir()
        environment.update(TMPDIR=str(temporary), TMP=str(temporary), TEMP=str(temporary),
                           XDG_CACHE_HOME=str(cache))
        try:
            publish_seconds = run_command(
                [
                    str(executable),
                    "publish",
                    "--strict",
                    "--config",
                    "mokly.config.json",
                    "--repository",
                    "github.com/" + configuration.repository,
                    "--endpoint",
                    url,
                ] + (["--debug-timings"] if debug_timings else []),
                configuration.checkout,
                "mokly publish",
                environment,
            )
        except CaptureError:
            endpoint.raise_refusal()
            raise
    endpoint.require_exchange()
    return install_seconds, publish_seconds


def require_envelope(envelope, expected):
    version = envelope.get("schemaVersion")
    if type(version) is not int or version != 3:
        raise CaptureError("mokly-upload.json schemaVersion must be 3")
    owner, name = expected.repository.split("/")
    checks = {
        "repository": {"host": "github.com", "owner": owner, "name": name},
        "branch": expected.branch,
        "headSha": expected.revision,
        "configPath": "mokly.config.json",
        "baseRef": "origin/main",
        "baseSha": expected.base_sha,
    }
    for field, value in checks.items():
        if envelope.get(field) != value:
            raise CaptureError(f"mokly-upload.json {field} does not match the capture")
    if "pullRequest" not in envelope:
        raise CaptureError("mokly-upload.json pullRequest is missing")
    pull_request = envelope["pullRequest"]
    if expected.pull_request is None:
        if pull_request is not None:
            raise CaptureError("mokly-upload.json pullRequest must be null")
    elif type(pull_request) is not int or pull_request != expected.pull_request:
        raise CaptureError("mokly-upload.json pullRequest does not match the capture")


def remove_path(path):
    """Remove a stale capture result, whether a directory, file or link."""
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def parse_arguments(values=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("environment", nargs="?")
    parser.add_argument("--local", action="store_true")
    parser.add_argument("--checkout", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--branch")
    parser.add_argument("--debug-timings", action="store_true")
    return parser.parse_args(values)


def main(values=None, variables=os.environ):
    staged = None
    started = time.monotonic()
    try:
        remove_path(CATALOGUE)
        arguments = parse_arguments(values)
        configuration = settings(arguments, variables)
        CATALOGUE.parent.mkdir(parents=True, exist_ok=True)
        staged = Path(tempfile.mkdtemp(prefix=".capture-", dir=CATALOGUE.parent))
        install_seconds, publish_seconds = capture_exchange(
            configuration, configuration.pull_request is None, staged,
            arguments.debug_timings,
        )
        plan = read_plan(staged / "plan.tar.gz")
        envelope = plan.envelope
        require_envelope(envelope, configuration)
        size = (staged / "plan.tar.gz").stat().st_size + sum(plan.missing.values())
        os.rename(staged, CATALOGUE)
        staged = None
        pull_request = envelope["pullRequest"]
        print(
            f"Captured catalogue: {plan.files} files, "
            f"{len(plan.missing)} blobs, {size} bytes"
        )
        print(
            "Envelope: "
            f"branch={json.dumps(envelope['branch'], ensure_ascii=False)} "
            f"headSha={envelope['headSha']} pullRequest={json.dumps(pull_request)} "
            f"configPath={envelope['configPath']} baseRef={envelope['baseRef']} "
            f"baseSha={envelope['baseSha']}"
        )
        if arguments.debug_timings:
            print("Capture timings: " + json.dumps({
                "headInstallSeconds": install_seconds,
                "publishSeconds": publish_seconds,
                "totalSeconds": time.monotonic() - started,
            }, sort_keys=True))
        return 0
    except (
        CaptureError,
        EndpointError,
        KeyError,
        OSError,
        PlanError,
        PreviewInputError,
    ) as error:
        try:
            remove_path(CATALOGUE)
        except OSError:
            pass
        print(f"Catalogue capture failed: {error}", file=sys.stderr)
        return 1
    finally:
        if staged is not None:
            shutil.rmtree(staged, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
