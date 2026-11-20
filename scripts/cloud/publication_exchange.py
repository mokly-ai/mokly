"""Plan, blob and completion requests of the publication upload exchange."""

from functools import partial
import hashlib
import http.client
import json
import re
import urllib.parse
import uuid

from publication_smoke_support import archive, read_response_after_send

ENVELOPE = "mokly-upload.json"
MARKER = ".mokly-export-artifact"
INDEX = "mokly-viewer/index.json"
EXPIRY = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def with_marker(files):
    """Declare every export file in a fresh schema 3 ownership marker."""
    declared = [{"path": path, "sha256": digest(data), "size": len(data)}
                for path, data in sorted(files.items()) if path != MARKER]
    owned = dict(files)
    owned[MARKER] = (json.dumps({"schemaVersion": 3, "files": declared}, indent=2) + "\n").encode()
    return owned


def artifact_names(files):
    """The three required Plan files in the released CLI's order."""
    return [ENVELOPE, MARKER, INDEX]


def current_only_files(files):
    """Remove comparison artifacts and disable index Changes with the envelope."""
    changed = {path: data for path, data in files.items() if not path.startswith("mokly-viewer/diffs/")}
    envelope = json.loads(changed[ENVELOPE])
    envelope.update(baseRef=None, baseSha=None)
    changed[ENVELOPE] = json.dumps(envelope).encode()
    index = json.loads(changed[INDEX])
    index.pop("baseCommit", None)
    index.update(comparisonUrl=None, changesStatus="disabled", removedEntries=[])
    for kind in ["components", "documents", "pages", "screens", "useCases"]:
        for record in index[kind]:
            record["changes"] = {"status": "disabled"}
            record.pop("previousPath", None)
            if "comparison" in record:
                record["comparison"] = {"status": "disabled"}
            for view in record.get("views", []):
                view["comparison"] = {"status": "disabled"}
    for path, data in list(changed.items()):
        if not path.startswith("mokly-viewer/entries/") or not path.endswith(".json"):
            continue
        detail = json.loads(data)
        for key in ["reasons", "before", "resourceEvidence", "workspace"]:
            detail.pop(key, None)
        for view in detail["views"]:
            for key in ["state", "ignoredIds", "resourceEvidence"]:
                view.pop(key, None)
        changed[path] = json.dumps(detail).encode()
    changed[INDEX] = json.dumps(index).encode()
    return with_marker(changed)


def plan_archive(files):
    return archive({name: files[name] for name in artifact_names(files)})


def send(api, method, path, secret, body=b"", headers=None, chunked=False):
    """One request on the API origin; returns the status and decoded JSON body."""
    address = urllib.parse.urlsplit(api.url)
    connection = http.client.HTTPConnection(address.hostname, address.port, timeout=120)
    request_headers = {"Authorization": "Bearer " + secret} if secret else {}
    request_headers.update(headers or {})
    try:
        if chunked:
            request_headers["Transfer-Encoding"] = "chunked"
        request = partial(connection.request, method, path, body=iter([body]) if chunked else body,
                          headers=request_headers, encode_chunked=chunked)
        response, data = read_response_after_send(request, connection.getresponse)
        assert response.getheader("Cache-Control") == "no-store", (method, path)
        assert response.getheader("X-Request-ID"), (method, path)
        return response.status, json.loads(data) if data else None
    finally:
        connection.close()


def expect(status, value, expected):
    statuses = expected if isinstance(expected, tuple) else (expected,)
    assert status in statuses, (status, expected, value)
    return value


def reason(value):
    return value["error"]["reason"]


def plan(api, project, secret, body, expected=200, content_type="application/gzip", headers=None):
    request_headers = {"Content-Type": content_type}
    request_headers.update(headers or {})
    status, value = send(api, "POST", "/v1/projects/" + project["id"] + "/publications", secret, body,
                         request_headers)
    expect(status, value, expected)
    if status == 200:
        check_plan(api, project, value)
    return value


def check_plan(api, project, value):
    """The released plan v1 shape, on the API origin the CLI was given."""
    upload = value["upload"]
    assert set(value) == {"schemaVersion", "upload", "missing", "blobUrl", "completeUrl"}, value
    assert value["schemaVersion"] == 1 and set(upload) == {"id", "expiresAt"}, value
    assert str(uuid.UUID(upload["id"])) == upload["id"], value
    assert EXPIRY.fullmatch(upload["expiresAt"]), value
    assert value["missing"] == sorted(set(value["missing"])), value
    base = api.url + "/v1/projects/" + project["id"] + "/publication-uploads/" + upload["id"]
    assert value["blobUrl"] == base + "/blobs/{sha256}", value
    assert value["completeUrl"] == base + "/complete", value


def blob_path(planned, hash_):
    return urllib.parse.urlsplit(planned["blobUrl"].replace("{sha256}", hash_)).path


def put_blob(api, planned, secret, hash_, data, expected=204, headers=None, path=None, chunked=False):
    request_headers = {"Content-Type": "application/octet-stream"}
    request_headers.update(headers or {})
    status, value = send(api, "PUT", path or blob_path(planned, hash_), secret, data, request_headers, chunked)
    return expect(status, value, expected)


def completion(api, planned, secret, body=b"", headers=None, path=None):
    """One completion request; returns its status and decoded body."""
    target = path or urllib.parse.urlsplit(planned["completeUrl"]).path
    return send(api, "POST", target, secret, body, headers)


def complete(api, planned, secret, expected=201, body=b"", headers=None, path=None):
    status, value = completion(api, planned, secret, body, headers, path)
    return expect(status, value, expected)


def exchange(api, project, secret, files, expected=201):
    """Run the CLI's plan, blob and completion sequence; return the plan and receipt."""
    planned = plan(api, project, secret, plan_archive(files))
    contents = {digest(data): data for data in files.values()}
    for hash_ in planned["missing"]:
        put_blob(api, planned, secret, hash_, contents[hash_])
    return planned, complete(api, planned, secret, expected)


def publish(api, project, secret, files, expected=201):
    return exchange(api, project, secret, files, expected)[1]
