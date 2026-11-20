"""Plan rejections, keep-first completion and reference counts over the exchange."""

import gzip
import json
import tarfile
import uuid
from concurrent.futures import ThreadPoolExecutor

from publication_exchange import (
    ENVELOPE,
    INDEX,
    MARKER,
    current_only_files,
    completion,
    exchange,
    plan,
    plan_archive,
    reason,
    with_marker,
)
from publication_smoke_support import archive


def count(api, project, condition="true"):
    return api.sql("SELECT count(*) FROM publications WHERE project_id='" + project["id"] + "' AND " + condition)


def plan_rejection(api, project, token):
    workspace = project["workspaceId"]
    before = count(api, project)
    api.sql("UPDATE organizations SET plan='free' WHERE id='" + workspace + "'")
    try:
        error = plan(api, project, token["secret"], b"body must not be read", 403)
        assert reason(error) == "upload-plan-required"
        assert count(api, project) == before
    finally:
        api.sql("UPDATE organizations SET plan='team' WHERE id='" + workspace + "'")
    print("PASS private publication plan requires Team before reading the body")


def envelope(files, **changes):
    changed = dict(files)
    manifest = json.loads(changed[ENVELOPE])
    manifest.update(changes)
    changed[ENVELOPE] = json.dumps(manifest).encode()
    return changed


def marker(export, **changes):
    changed = dict(export)
    value = json.loads(changed[MARKER])
    value.update(changes)
    changed[MARKER] = json.dumps(value).encode()
    return changed


def transport_rejections(api, project, secret, files):
    body = plan_archive(files)
    assert reason(plan(api, dict(project, id=str(uuid.uuid4())), secret, body, 403)) == "upload-forbidden"
    for credential in [None, "mkc_invalid", "mkc_" + "f" * 64]:
        assert reason(plan(api, project, credential, b"invalid", 401)) == "upload-unauthorized"
    assert reason(plan(api, project, secret, body, 400, "application/json")) == "upload-invalid-bundle"
    assert reason(plan(api, project, secret, b"not gzip", 400)) == "upload-invalid-bundle"
    oversized_body = {"Content-Length": str(100 * 1024 * 1024 + 1)}
    assert reason(plan(api, project, secret, b"", 413, headers=oversized_body)) == "upload-too-large"
    oversized = tarfile.TarInfo("oversized.bin")
    oversized.size = 64 * 1024 * 1024 + 1
    assert reason(plan(api, project, secret, gzip.compress(oversized.tobuf() + bytes(1024)), 413)) == "upload-too-large"


def marker_rejections(api, project, secret, files):
    for version in [1, 2, "3", 4]:
        changed = marker(files, schemaVersion=version)
        refused = plan(api, project, secret, plan_archive(changed), 426)
        assert reason(refused) == "upload-unsupported-version"
        assert refused["error"]["message"] == "Update Mokly to 0.18.0 and publish again."
        assert "data" not in refused["error"]
    entry = {"path": "index.html", "sha256": "0" * 64, "size": 1}
    for entries in [[dict(entry, path="p" + str(index) + ".html") for index in range(20_000)],
                    [dict(entry, size=64 * 1024 * 1024 + 1)]]:
        changed = marker(files, files=entries)
        assert reason(plan(api, project, secret, plan_archive(changed), 413)) == "upload-too-large"
    invalid = [[dict(entry, sha256="A" * 64)], [dict(entry, size=-1)], [entry, entry]]
    for entries in invalid:
        changed = marker(files, files=entries)
        assert reason(plan(api, project, secret, plan_archive(changed), 400)) == "upload-invalid-bundle"
    return len(invalid)


def content_rejections(api, project, secret, files):
    """Each case keeps a valid, authorized envelope, so the attempt keeps its identity."""
    for field, value, status, label in [
        ("schemaVersion", 99, 426, "upload-unsupported-version"),
        ("configPath", "another.config.json", 403, "upload-forbidden"),
        ("repository", {"host": "github.com", "owner": "elsewhere", "name": "private"}, 403, "upload-forbidden"),
    ]:
        changed = with_marker(envelope(files, **{field: value}))
        assert reason(plan(api, project, secret, plan_archive(changed), status)) == label
    names = [ENVELOPE, MARKER, INDEX]
    for body in [plan_archive(with_marker(envelope(files, schemaVersion=1)))] + [
            plan_archive(with_marker(dict(files, **{names[2]: json.dumps({"schemaVersion": version}).encode()})))
            for version in [5, 8]]:
        refused = plan(api, project, secret, body, 426)
        assert reason(refused) == "upload-unsupported-version"
        assert refused["error"]["message"] == "Update Mokly to 0.18.0 and publish again."
        assert "data" not in refused["error"]
    extra = archive(dict({name: files[name] for name in names}, **{"index.html": files["index.html"]}))
    invalid = [extra, plan_archive(envelope(files, branch="unlisted-digest"))]
    for reserved in ["_access", "__blobs/file.html", "__mokly/catalogue.json"]:
        invalid.append(plan_archive(with_marker(dict(files, **{reserved: b"reserved"}))))
    invalid.append(plan_archive(with_marker(dict(files, **{names[2]: b"invalid index"}))))
    unindexed = with_marker({name: data for name, data in files.items() if name != names[2]})
    invalid.append(archive({name: unindexed[name] for name in names[:2]}))
    for body in invalid:
        assert reason(plan(api, project, secret, body, 400)) == "upload-invalid-bundle"
    return len(invalid)


def rejections(api, project, token, files):
    secret = token["secret"]
    # Refused comparison metadata stays with the open rejected-identity Rust regression.
    # This matrix keeps its authorized head checks through a current-only envelope.
    files = current_only_files(files)
    transport_rejections(api, project, secret, files)
    invalid = marker_rejections(api, project, secret, files) + content_rejections(api, project, secret, files)
    retained = count(api, project, "state='failed' AND head_sha IS NOT NULL AND failure_code='invalid-bundle'")
    assert retained == str(invalid), (retained, invalid)
    assert count(api, project, "failure_code='unauthorized' AND head_sha IS NOT NULL") == "0"
    assert count(api, project, "state IN ('uploading', 'validating')") == "0"
    print("PASS publication plan rejection matrix: 426, 400, 401, 403 and 413")


def idempotency(api, project, token, files):
    """Overlapping uploads keep the first completion; repeats answer from persisted state."""
    secret = token["secret"]
    with ThreadPoolExecutor(max_workers=2) as pool:
        rounds = list(pool.map(lambda _: exchange(api, project, secret, files, (200, 201)), range(2)))
    first = rounds[0][1]
    assert rounds[1][1] == first
    statuses = sorted(completion(api, planned, secret)[0] for planned, _ in rounds)
    assert statuses == [200, 201], statuses
    with ThreadPoolExecutor(max_workers=2) as pool:
        replays = list(pool.map(lambda _: exchange(api, project, secret, files, 200), range(2)))
    assert all(planned["missing"] == [] and receipt == first for planned, receipt in replays)
    head = json.loads(files[ENVELOPE])["headSha"]
    assert count(api, project, "state='ready' AND head_sha='" + head + "'") == "1"
    assert api.sql("SELECT count(*) FROM publication_files f JOIN publications p ON p.id=f.publication_id WHERE p.project_id='" + project["id"] + "' AND p.state='failed'") == "0"
    assert api.sql("SELECT count(*) FROM blobs b WHERE b.ref_count<>(SELECT count(*) FROM publication_files f WHERE f.project_id=b.project_id AND f.blob_hash=b.hash)") == "0"
    connections = int(api.sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='mkc_api_smoke' AND pid<>pg_backend_pid()"))
    assert connections <= 9
    print("MEASURE concurrent publication writes: retained_api_database_connections=" + str(connections) + " pool_capacity=8 health_capacity=1")
    print("PASS keep-first completion: one 201, superseded 200, repeated completion statuses, empty replay plans and reference counts")
    return first
