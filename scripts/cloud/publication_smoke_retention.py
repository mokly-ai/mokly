"""Advance maintenance time, then fetch old URLs and replay the same head."""

import json
import subprocess

from publication_exchange import (
    ENVELOPE,
    completion,
    digest,
    exchange,
    plan,
    plan_archive,
    publish,
    put_blob,
    reason,
    with_marker,
)


def head(files, sha):
    changed = dict(files)
    manifest = json.loads(changed[ENVELOPE])
    manifest["headSha"] = sha
    changed[ENVELOPE] = json.dumps(manifest).encode()
    return with_marker(changed)


def expired_attempt(api, planned, secret, files):
    """The worker closes an unfinished attempt; its requests then answer 410."""
    state = api.sql("SELECT state || ':' || failure_code FROM publications WHERE id='" + planned["upload"]["id"] + "'")
    assert state == "failed:expired", state
    status, body = completion(api, planned, secret)
    assert (status, reason(body)) == (410, "upload-expired")
    index = digest(files["index.html"])
    assert reason(put_blob(api, planned, secret, index, files["index.html"], 410)) == "upload-expired"


def replay_retained(api, catalogue, project, token, publication, files, executable):
    secret = token["secret"]
    newer = publish(api, project, secret, head(files, "d" * 40))
    unfinished_files = head(files, "d" * 39 + "e")
    unfinished = plan(api, project, secret, plan_archive(unfinished_files))
    ready_before = api.sql("SELECT count(*) FROM publications WHERE project_id='" + project["id"] + "' AND state='ready'")
    subprocess.run([executable, "--exact", "publication_retention_process", "--nocapture"],
                   env=dict(api.environment, MKC_SMOKE_PROCESS="retention"), check=True, timeout=30)
    catalogue.fetch(publication, expected=200)
    expired_attempt(api, unfinished, secret, unfinished_files)
    planned, replay = exchange(api, project, secret, files, 200)
    write_event = api.event("publication_id", planned["upload"]["id"])
    assert replay == publication
    assert replay["state"] == "ready"
    assert planned["missing"] == []
    assert write_event["missing"] == 0
    assert write_event["written"] == 0
    assert write_event["bytes"] == 0
    assert api.sql("SELECT head_sha FROM publications WHERE id='" + newer["id"] + "'") != api.sql(
        "SELECT head_sha FROM publications WHERE id='" + replay["id"] + "'")
    assert api.sql("SELECT state FROM publications WHERE id='" + publication["id"] + "'") == "ready"
    assert api.sql("SELECT count(*) FROM publications WHERE project_id='" + project["id"] + "' AND state='ready'") == ready_before
    for ready in [newer, publication]:
        body, _ = catalogue.fetch(ready, "/index.html")
        assert body == files["index.html"]
    print("TRACE publication upload planned publication_id=" + planned["upload"]["id"] +
          " files=" + str(write_event["files"]) +
          " distinct_hashes=" + str(write_event["distinct_hashes"]) +
          " missing=" + str(write_event["missing"]) +
          " written=" + str(write_event["written"]) +
          " bytes=" + str(write_event["bytes"]) +
          " write_duration_ms=" + str(write_event["write_duration_ms"]))
    print("PASS same-head replay after 31 days kept its ready ID, planned no missing files and wrote nothing; old and newer catalogues returned HTTP 200")
    print("PASS retention closes unfinished attempts with 410 and keeps every successful publication")
    return replay
