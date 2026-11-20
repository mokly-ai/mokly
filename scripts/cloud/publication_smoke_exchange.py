"""Blob and completion status matrix, durable reuse and token revocation mid-exchange."""

import json
from pathlib import Path
import uuid

from publication_exchange import (
    ENVELOPE,
    artifact_names,
    blob_path,
    complete,
    completion,
    digest,
    plan,
    plan_archive,
    put_blob,
    reason,
    with_marker,
)


def identity(files, head):
    changed = dict(files)
    manifest = json.loads(changed[ENVELOPE])
    manifest["headSha"] = head
    changed[ENVELOPE] = json.dumps(manifest).encode()
    return with_marker(changed)


def stored(api, project, hashes):
    quoted = ",".join("'" + value + "'" for value in hashes)
    return int(api.sql("SELECT count(*) FROM blobs WHERE project_id='" + project["id"] +
                       "' AND stored_at IS NOT NULL AND hash IN (" + quoted + ")"))


def blob_rejections(api, project, secret, planned, contents):
    """Every refusal happens before the body is stored."""
    target = max(planned["missing"], key=lambda value: len(contents[value]))
    data = contents[target]
    cases = [
        ({"headers": {"Content-Type": "application/gzip"}}, data, 400, "upload-invalid-bundle"),
        ({"chunked": True}, data, 400, "upload-invalid-bundle"),
        ({"headers": {"Content-Length": str(64 * 1024 * 1024 + 1)}}, b"", 413, "upload-too-large"),
        ({"path": blob_path(planned, target) + "?retry=1"}, data, 400, "upload-invalid-bundle"),
        ({}, data + b"!", 400, "upload-blob-mismatch"),
        ({}, bytes(len(data)), 400, "upload-blob-mismatch"),
    ]
    for options, body, status, label in cases:
        assert reason(put_blob(api, planned, secret, target, body, status, **options)) == label
    for unknown in [digest(b"not reserved"), "NOT-A-DIGEST"]:
        rejected = put_blob(api, planned, secret, unknown, b"not reserved", 404)
        assert reason(rejected) == "upload-unknown-blob"
    for attempt in [str(uuid.uuid4()), "u-1"]:
        path = blob_path(planned, target).replace(planned["upload"]["id"], attempt)
        assert reason(put_blob(api, planned, secret, target, data, 404, path=path)) == "not-found"
    assert stored(api, project, [target]) == 0


def completion_rejections(api, planned, secret):
    assert reason(complete(api, planned, secret, 409)) == "upload-incomplete"
    body = complete(api, planned, secret, 400, b"{}", {"Content-Type": "application/json"})
    assert reason(body) == "upload-invalid-bundle"
    path = "/v1/projects/" + planned["blobUrl"].split("/v1/projects/", 1)[1].split("/")[0]
    unknown = path + "/publication-uploads/" + str(uuid.uuid4()) + "/complete"
    assert reason(complete(api, planned, secret, 404, path=unknown)) == "not-found"


def exchange_matrix(api, project, token, files):
    secret = token["secret"]
    changed = identity(files, "c" * 40)
    contents = {digest(data): data for data in changed.values()}
    planned = plan(api, project, secret, plan_archive(changed))
    artifacts = {digest(changed[name]) for name in artifact_names(changed)}
    declared = {digest(data) for data in changed.values()} - artifacts
    assert set(planned["missing"]) <= declared and planned["missing"], planned
    assert stored(api, project, artifacts) == len(artifacts)
    blob_rejections(api, project, secret, planned, contents)
    completion_rejections(api, planned, secret)
    for value in planned["missing"]:
        put_blob(api, planned, secret, value, contents[value])
    put_blob(api, planned, secret, planned["missing"][0], contents[planned["missing"][0]])
    assert stored(api, project, planned["missing"]) == len(planned["missing"])
    receipt = complete(api, planned, secret, 201)
    assert receipt["id"] == planned["upload"]["id"] and receipt["state"] == "ready"
    assert complete(api, planned, secret, 201) == receipt
    closed = put_blob(api, planned, secret, planned["missing"][0], contents[planned["missing"][0]], 410)
    assert reason(closed) == "upload-expired"
    reuse(api, project, secret, files, contents)
    print("PASS upload exchange: blob and completion refusals, idempotent PUT, repeated 201 and closed-attempt 410")
    return receipt


def reuse(api, project, secret, files, contents):
    """A durable reserved hash answers 204 without storing a second object."""
    changed = identity(files, "c" * 39 + "d")
    planned = plan(api, project, secret, plan_archive(changed))
    assert planned["missing"] == [], planned
    index = digest(changed["index.html"])
    objects = sorted(Path(api.blobs.name).glob("sha256/" + index + "/*"))
    put_blob(api, planned, secret, index, contents[index])
    assert sorted(Path(api.blobs.name).glob("sha256/" + index + "/*")) == objects
    complete(api, planned, secret, 201)


def revoked_mid_exchange(api, owner, project, files):
    token, _ = api.call("POST", "/v1/projects/" + project["id"] + "/tokens", {"name": "Revoke mid-exchange"}, owner, 201)
    changed = identity(files, "e" * 39 + "f")
    planned = plan(api, project, token["secret"], plan_archive(changed))
    api.call("DELETE", "/v1/projects/" + project["id"] + "/tokens/" + token["token"]["id"], session=owner, expected=204)
    value = planned["missing"][0] if planned["missing"] else digest(changed["index.html"])
    contents = {digest(data): data for data in changed.values()}
    assert reason(put_blob(api, planned, token["secret"], value, contents[value], 401)) == "upload-unauthorized"
    status, body = completion(api, planned, token["secret"])
    assert (status, reason(body)) == (401, "upload-unauthorized")
    print("PASS token revocation between plan, blob and completion refuses the remaining requests")
