"""Conditional bucket IAM and live-object cleanup for PR previews."""

import json
import os
from pathlib import Path
import re
import tempfile
import time

from preview_lifecycle_core import (
    BUCKET,
    PROJECT,
    CommandFailure,
    preview_parts,
    run_command,
)


def project_number():
    output = run_command([
        "gcloud", "projects", "describe", PROJECT,
        "--format=value(projectNumber)",
    ]).strip()
    if not re.fullmatch(r"[1-9][0-9]+", output):
        raise ValueError("gcloud returned an invalid numeric project number")
    return output


def iam_tuples(environment, number, bucket):
    _, namespace, prefix = preview_parts(environment)
    condition = {
        "title": f"mkc-{environment}",
        "description": f"Objects for {environment}",
        "expression": f"resource.name.startsWith('projects/_/buckets/{bucket}/objects/{prefix}/')",
    }
    base = (
        f"principal://iam.googleapis.com/projects/{number}/locations/global/"
        f"workloadIdentityPools/{PROJECT}.svc.id.goog/subject/ns/{namespace}/sa/"
    )
    return (
        ("roles/storage.objectUser", base + "api", condition),
        ("roles/storage.objectViewer", base + "catalogue", condition),
    )


def change_bindings(policy, tuples, add):
    bindings = policy.get("bindings", [])
    if not isinstance(bindings, list) or any(not isinstance(item, dict) for item in bindings):
        raise ValueError("bucket IAM policy bindings are malformed")
    changed = policy.get("version") != 3
    policy["version"] = 3
    for role, member, condition in tuples:
        matches = [item for item in bindings if item.get("role") == role and item.get("condition") == condition]
        for item in matches:
            members = item.get("members")
            if not isinstance(members, list) or any(not isinstance(value, str) for value in members):
                raise ValueError("bucket IAM policy members are malformed")
        if add:
            if any(member in item.get("members", []) for item in matches):
                continue
            target = matches[0] if matches else {"role": role, "members": [], "condition": condition}
            if not matches:
                bindings.append(target)
            members = target.get("members")
            members.append(member)
            members.sort()
            changed = True
        else:
            for item in list(matches):
                members = item.get("members")
                if member in members:
                    item["members"] = [value for value in members if value != member]
                    if not item["members"]:
                        bindings.remove(item)
                    changed = True
    policy["bindings"] = bindings
    return changed


def is_etag_conflict(error):
    return bool(re.search(r"(?:HTTPError\s+)?412\b|conditionNotMet|pre-?condition", error.stderr, re.I))


def change_iam(environment, add, variables=os.environ, sleeper=time.sleep):
    """Read, modify and write the bucket policy at version 3 under its etag.

    Unrelated bindings and members survive; an etag conflict is retried at
    most four more times with exponential backoff, then fails."""
    bucket = variables["MKC_PREVIEW_BLOBS_BUCKET"]
    if bucket != BUCKET:
        raise ValueError(f"preview bucket must be {BUCKET}")
    tuples = iam_tuples(environment, project_number(), bucket)
    for attempt in range(5):
        policy_text = run_command([
            "gcloud", "storage", "buckets", "get-iam-policy", f"gs://{bucket}",
            "--format=json", f"--project={PROJECT}",
        ])
        try:
            policy = json.loads(policy_text)
        except json.JSONDecodeError as error:
            raise ValueError("gcloud returned malformed bucket IAM JSON") from error
        etag = policy.get("etag") if isinstance(policy, dict) else None
        if not isinstance(etag, str) or not etag:
            raise ValueError("bucket IAM policy has no etag")
        if not change_bindings(policy, tuples, add):
            return False
        descriptor, path = tempfile.mkstemp(prefix="mkc-preview-policy-", suffix=".json")
        try:
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "w") as output:
                json.dump(policy, output)
            try:
                result = run_command([
                    "gcloud", "storage", "buckets", "set-iam-policy", f"gs://{bucket}", path,
                    f"--etag={etag}", "--format=json", f"--project={PROJECT}", "--quiet",
                ])
                if result.strip() and not isinstance(json.loads(result), dict):
                    raise ValueError("gcloud returned malformed IAM update JSON")
                return True
            except CommandFailure as error:
                if is_etag_conflict(error) and attempt < 4:
                    sleeper(2 ** attempt)
                    continue
                raise
        finally:
            Path(path).unlink(missing_ok=True)
    raise ValueError("bucket IAM update exhausted etag retries")


def parse_json_documents(value):
    decoder = json.JSONDecoder()
    position = 0
    documents = []
    while position < len(value):
        while position < len(value) and value[position].isspace():
            position += 1
        if position == len(value):
            break
        document, position = decoder.raw_decode(value, position)
        documents.append(document)
    return documents


REMOVAL_BATCH = 200
REMOVAL_ERROR = "ERROR: (gcloud.storage.rm) The following URLs matched no objects or files:"
PROGRESS_LINE = re.compile(r"^(Removing objects:|\s*|\.+|Removing gs://\S+\.\.\.)$")


def missing_objects(error):
    if error.returncode != 1 or error.stdout or error.command[:3] != ["gcloud", "storage", "ls"]:
        return False
    return error.stderr.rstrip("\n") == (
        "ERROR: (gcloud.storage.ls) One or more URLs matched no objects."
    )


def missing_removals(error, batch):
    """The URLs a batch removal refused because they no longer exist, or None.

    The CLI checks every URL before removing any: one vanished object fails the
    whole batch, removes nothing and lists only the missing URLs after its
    progress output. Anything else in the diagnostic is a real failure."""
    if error.returncode != 1 or error.stdout or error.command[:4] != [
        "gcloud", "storage", "rm", "--read-paths-from-stdin",
    ]:
        return None
    lines = error.stderr.rstrip("\n").split("\n")
    if REMOVAL_ERROR not in lines:
        return None
    marker = lines.index(REMOVAL_ERROR)
    missing = lines[marker + 1:]
    if not missing or not all(PROGRESS_LINE.fullmatch(line) for line in lines[:marker]):
        return None
    if not set(missing) <= set(batch):
        return None
    return missing


def listed_resources(documents):
    """The CLI answers `ls --json` with one JSON array of resources; each
    element, not the array, is the resource to validate."""
    resources = []
    for document in documents:
        if isinstance(document, list):
            resources.extend(document)
        else:
            resources.append(document)
    return resources


def list_objects(bucket, prefix):
    try:
        output = run_command([
            "gcloud", "storage", "ls", "--json", "--exhaustive",
            f"gs://{bucket}/{prefix}/**", f"--project={PROJECT}",
        ])
    except CommandFailure as error:
        if missing_objects(error):
            return []
        raise
    try:
        documents = parse_json_documents(output)
    except (json.JSONDecodeError, TypeError) as error:
        raise ValueError("gcloud returned malformed object listing JSON") from error
    expected = f"gs://{bucket}/{prefix}/"
    urls = []
    for document in listed_resources(documents):
        url = document.get("url") if isinstance(document, dict) else None
        metadata = document.get("metadata", {}) if isinstance(document, dict) else {}
        if not isinstance(document, dict) or document.get("type") != "cloud_object" or not isinstance(url, str):
            raise ValueError("gcloud object listing contains a non-object resource")
        name = metadata.get("name") if isinstance(metadata, dict) else None
        if not url.startswith(expected) or metadata.get("bucket") != bucket or not isinstance(name, str) or not name.startswith(prefix + "/"):
            raise ValueError("gcloud object listing escaped the preview prefix")
        urls.append(url)
    return urls


def remove_batch(batch):
    """Remove one batch of listed URLs in a single CLI call, dropping URLs the
    CLI reports as already gone and retrying the rest; every retry shrinks the
    batch, so the loop ends."""
    pending = list(batch)
    while pending:
        try:
            run_command(
                ["gcloud", "storage", "rm", "--read-paths-from-stdin", f"--project={PROJECT}", "--quiet"],
                stdin="".join(f"{url}\n" for url in pending),
            )
            return
        except CommandFailure as error:
            missing = missing_removals(error, pending)
            if missing is None:
                raise
            pending = [url for url in pending if url not in missing]


def delete_objects(environment, variables=os.environ):
    _, _, prefix = preview_parts(environment)
    bucket = variables["MKC_PREVIEW_BLOBS_BUCKET"]
    if bucket != BUCKET:
        raise ValueError(f"preview bucket must be {BUCKET}")
    failures = []
    urls = list_objects(bucket, prefix)
    for offset in range(0, len(urls), REMOVAL_BATCH):
        try:
            remove_batch(urls[offset:offset + REMOVAL_BATCH])
        except CommandFailure as error:
            failures.append(str(error))
    remaining = list_objects(bucket, prefix)
    if remaining:
        failures.append(f"{len(remaining)} live preview objects remain")
    if failures:
        raise ValueError("; ".join(failures))
