"""Publication integration-only HTTP and child-process helpers."""

import errno
import http.client
import io
import json
import tarfile
import urllib.parse
import uuid

from smoke_support import Api


class Catalogue(Api):
    def __init__(self, executable, api, desktop_client=None):
        database = api.environment["MKC_DATABASE_URL"].replace(
            "application_name=mkc_api_smoke", "application_name=mkc_catalogue_smoke")
        overrides = dict(api.environment, MKC_SMOKE_PROCESS="catalogue", MKC_CATALOGUE_BIND="127.0.0.1:0",
                         MKC_DATABASE_URL=database)
        if desktop_client is not None:
            overrides["MKC_DESKTOP_CLIENT"] = str(desktop_client).lower()
        super().__init__(executable, command=[executable, "--exact", "publication_catalogue_process", "--nocapture"],
                         overrides=overrides)

    def fetch(self, publication, path="/", method="GET", body=None, cookie=None, origin=None, host=None,
              expected=200, request_headers=None):
        authority = host or urllib.parse.urlsplit(publication["catalogueUrl"]).netloc
        address = urllib.parse.urlsplit(self.url)
        connection = http.client.HTTPConnection(address.hostname, address.port, timeout=30)
        headers = {"Host": authority}
        if cookie:
            headers["Cookie"] = cookie
        if origin:
            headers["Origin"] = origin
        if body is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(body).encode()
        headers.update(request_headers or {})
        try:
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            data = response.read()
            assert response.status == expected, (
                method, path, response.status, expected, data[:500], self.lines[-20:])
            assert response.getheader("X-Content-Type-Options") == "nosniff"
            assert response.getheader("Vary") == "Origin, Cookie, Accept-Encoding"
            csp = response.getheader("Content-Security-Policy")
            directives = [part.strip().split() for part in csp.split(";")]
            ancestors = [part[1:] for part in directives if part and part[0] == "frame-ancestors"]
            expected = ["'self'", self.origin]
            if self.environment.get("MKC_DESKTOP_CLIENT") == "true":
                expected.append("mokly-app://desktop")
            assert ancestors == [expected], ancestors
            return data, dict((key.lower(), value) for key, value in response.getheaders())
        finally:
            connection.close()


def files_from_tar(body):
    with tarfile.open(fileobj=io.BytesIO(body), mode="r:gz") as archive:
        return {item.name: archive.extractfile(item).read() for item in archive if item.isfile()}


def archive(files):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz", format=tarfile.USTAR_FORMAT) as output:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            output.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


def project_and_token(api, owner, name):
    suffix = uuid.uuid4().hex
    workspace, _ = api.call("POST", "/v1/workspaces", {"name": name, "slug": "o-" + suffix}, owner, 201)
    api.sql("UPDATE organizations SET plan='team' WHERE id='" + workspace["id"] + "'")
    repository = api.installed_repository(workspace["id"], "mokly-ai/mokly-cloud")
    project, _ = api.call("POST", "/v1/workspaces/" + workspace["id"] + "/projects",
                          {"name": name, "slug": "p-" + suffix, "repositoryId": repository, "configPath": "mokly.config.json"}, owner, 201)
    assert project["visibility"] == "private"
    token, _ = api.call("POST", "/v1/projects/" + project["id"] + "/tokens", {"name": "Publication smoke"}, owner, 201)
    return workspace, project, token


def read_response_after_send(send_request, read_response):
    """Read headers and body after a send, preserving an early refusal's cause."""
    send_error = None
    try:
        send_request()
    except OSError as error:
        if not isinstance(error, (BrokenPipeError, ConnectionResetError)) and error.errno != errno.EPROTOTYPE:
            raise
        send_error = error
    try:
        response = read_response()
        if send_error is not None and response.status < 400:
            raise AssertionError("Publication request has a truncated body; the server did not refuse it.")
        body = response.read()
        return response, body
    except Exception as error:
        if send_error is not None:
            raise error from send_error
        raise
