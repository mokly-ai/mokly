#!/usr/bin/env python3
"""Fixture-backed Mokly CLI double that runs the pinned CLI's upload exchange."""

import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


MARKER = ".mokly-export-artifact"
DIGEST = re.compile(r"[a-f0-9]{64}")
TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z")
REFUSALS = {400: "invalid-bundle", 413: "too-large"}


def fixture(name):
    return (Path(os.environ["MKC_CAPTURE_FIXTURES"]) / name).read_text()


def replay(name):
    sys.stdout.write(fixture(f"mokly-publish-{name}.stdout.txt"))
    sys.stderr.write(fixture(f"mokly-publish-{name}.stderr.txt"))
    return int(fixture(f"mokly-publish-{name}.exit.txt"))


def option(arguments, name):
    try:
        index = arguments.index(name)
        return arguments[index + 1]
    except (ValueError, IndexError):
        raise ValueError(f"missing {name}") from None


def send(method, url, token, body=None, content_type=None):
    """Send one request with the pinned CLI's headers for its step."""
    headers = {"Authorization": "Bearer " + token}
    if method == "POST":
        headers["Accept"] = "application/json"
    if content_type is not None:
        headers["Content-Type"] = content_type
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=10) as response:
            return response.status, response.headers.get("Content-Type"), response.read()
    except HTTPError as error:
        return error.code, error.headers.get("Content-Type"), error.read()


def origin(url):
    parsed = urlsplit(url)
    return parsed.scheme, parsed.hostname, parsed.port


def valid_plan(content_type, body, endpoint, digests):
    """Apply the pinned CLI's plan response checks; None fails the upload."""
    try:
        plan = json.loads(body)
        upload, missing = plan["upload"], plan["missing"]
        probe = plan["blobUrl"].replace("{sha256}", "a" * 64)
        valid = (
            (content_type or "").split(";", 1)[0].strip().lower() == "application/json"
            and type(plan["schemaVersion"]) is int
            and plan["schemaVersion"] == 1
            and 0 < len(upload["id"].encode()) <= 255
            and TIMESTAMP.fullmatch(upload["expiresAt"])
            and all(DIGEST.fullmatch(digest) and digest in digests for digest in missing)
            and missing == sorted(set(missing))
            and plan["blobUrl"].count("{sha256}") == 1
            and "a" * 64 in urlsplit(probe).path
            and origin(probe) == origin(endpoint)
            and origin(plan["completeUrl"]) == origin(endpoint)
        )
    except (AttributeError, KeyError, TypeError, ValueError):
        return None
    return plan if valid else None


def exchange(endpoint, token, mode, statuses):
    """Run Plan, Blobs and Complete like the pinned CLI, with optional faults."""
    export = Path(os.environ["MKC_CAPTURE_TEST_EXPORT"])
    blobs = {}
    for path in sorted(export.rglob("*")):
        if path.is_file() and path.name != MARKER:
            blobs[hashlib.sha256(path.read_bytes()).hexdigest()] = path.read_bytes()
    marker = json.loads((export / MARKER).read_text())
    digests = {entry["sha256"] for entry in marker["files"]}
    body = Path(os.environ["MKC_CAPTURE_TEST_PLAN"]).read_bytes()
    status, content_type, answer = send("POST", endpoint, token, body, "application/gzip")
    statuses.append(status)
    if status != 200:
        return status
    plan = valid_plan(content_type, answer, endpoint, digests)
    if plan is None:
        return "invalid-plan"
    if mode == "early-complete":
        statuses.append(send("POST", plan["completeUrl"], token)[0])
        return None
    for index, digest in enumerate(plan["missing"]):
        data = blobs[digest]
        if index == 0 and mode == "wrong-hash":
            data = bytes([data[0] ^ 1]) + data[1:]
        if index == 0 and mode == "wrong-length":
            data += b"x"
        url = plan["blobUrl"].replace("{sha256}", digest)
        statuses.append(send("PUT", url, token, data, "application/octet-stream")[0])
        if index == 0 and mode == "repeated-hash":
            statuses.append(send("PUT", url, token, data, "application/octet-stream")[0])
    if mode == "unknown-blob":
        url = plan["blobUrl"].replace("{sha256}", "f" * 64)
        statuses.append(send("PUT", url, token, b"x", "application/octet-stream")[0])
    if mode == "unexpected-request":
        statuses.append(send("GET", endpoint, token)[0])
    if mode != "no-complete":
        statuses.append(send("POST", plan["completeUrl"], token)[0])
    if mode == "second-plan":
        statuses.append(send("POST", endpoint, token, body, "application/gzip")[0])
    return None


def main():
    mode = os.environ.get("MKC_CAPTURE_TEST_MODE", "success")
    arguments = sys.argv[1:]
    if arguments[:1] != ["publish"]:
        return 90
    if (
        "--strict" not in arguments
        or option(arguments, "--config") != "mokly.config.json"
        or option(arguments, "--repository")
        != "github.com/mokly-ai/mokly-cloud"
    ):
        return 92
    endpoint = option(arguments, "--endpoint")
    token = os.environ.get("MOKLY_TOKEN", "")
    if not re.fullmatch(r"[a-f0-9]{64}", token):
        return 91
    statuses = []
    bearer = os.environ.get("MKC_CAPTURE_TEST_BEARER")
    if bearer:
        descriptor = os.open(bearer, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as file:
            file.write(token)
    if "--debug-timings" in arguments:
        sys.stderr.write(fixture("mokly-publish-timings.stderr.txt"))
    if mode in {"failure", "git-uncommitted"}:
        observe(arguments, statuses)
        return replay(mode)
    refused = None if mode == "missing" else exchange(endpoint, token, mode, statuses)

    observe(arguments, statuses)
    if refused == "invalid-plan":
        sys.stderr.write("mokly double: the receiver's plan fails the CLI's checks\n")
        return 93
    if refused is not None:
        return replay(REFUSALS[refused]) if refused in REFUSALS else 94
    return replay("success")


def observe(arguments, statuses):
    """Record the capture invocation and requests without bearer values."""
    observation = {
        "arguments": arguments,
        "githubActions": os.environ.get("GITHUB_ACTIONS"),
        "headRef": os.environ.get("GITHUB_HEAD_REF"),
        "ref": os.environ.get("GITHUB_REF"),
        "statuses": statuses,
        "temporary": os.environ.get("TMPDIR"),
        "cache": os.environ.get("XDG_CACHE_HOME"),
    }
    Path(os.environ["MKC_CAPTURE_TEST_OBSERVATION"]).write_text(
        json.dumps(observation) + "\n"
    )


if __name__ == "__main__":
    raise SystemExit(main())
