"""Socket-level plan admission, disconnected plans and token revocation checks."""

from functools import partial
import socket
import http.client
import time
import urllib.parse

from publication_exchange import plan, plan_archive, reason
from publication_smoke_support import read_response_after_send


def bounded_admission(api, project, token, files):
    address = urllib.parse.urlsplit(api.url)
    connections = []
    query = "SELECT count(*) FROM publications WHERE project_id='" + project["id"] + "' AND state='uploading'"
    try:
        for _ in range(2):
            connection = socket.create_connection((address.hostname, address.port), timeout=5)
            connections.append(connection)
            headers = ("POST /v1/projects/" + project["id"] + "/publications HTTP/1.1\r\n"
                       "Host: localhost\r\nAuthorization: Bearer " + token["secret"] + "\r\n"
                       "Content-Type: application/gzip\r\nContent-Length: 1000\r\n\r\n")
            connection.sendall(headers.encode())
        deadline = time.monotonic() + 10
        while api.sql(query) != "2":
            assert time.monotonic() < deadline, "two plan streams were not admitted"
            time.sleep(0.02)
        reply = plan(api, project, token["secret"], plan_archive(files), 503)
        assert reason(reply) == "upload-unavailable"
    finally:
        for connection in connections:
            connection.close()
    deadline = time.monotonic() + 10
    while api.sql(query) != "0":
        assert time.monotonic() < deadline, "disconnected plans were not terminated"
        time.sleep(0.02)
    assert api.sql("SELECT count(*) FROM publications WHERE project_id='" + project["id"] + "' AND state='ready'") == "0"
    print("PASS two-stream plan admission, 503 backpressure and disconnect cleanup")


def revoked_in_flight(api, owner, project, files):
    token, _ = api.call("POST", "/v1/projects/" + project["id"] + "/tokens", {"name": "Revoke in flight"}, owner, 201)
    body = plan_archive(files)
    address = urllib.parse.urlsplit(api.url)
    connection = socket.create_connection((address.hostname, address.port), timeout=10)
    try:
        headers = ("POST /v1/projects/" + project["id"] + "/publications HTTP/1.1\r\n"
                   "Host: localhost\r\nAuthorization: Bearer " + token["secret"] + "\r\n"
                   "Content-Type: application/gzip\r\nContent-Length: " + str(len(body)) + "\r\n\r\n")
        connection.sendall(headers.encode())
        deadline = time.monotonic() + 10
        while api.sql("SELECT count(*) FROM publications WHERE project_id='" + project["id"] + "' AND state='uploading'") != "1":
            assert time.monotonic() < deadline
            time.sleep(0.02)
        api.call("DELETE", "/v1/projects/" + project["id"] + "/tokens/" + token["token"]["id"], session=owner, expected=204)
        response, response_body = read_response_after_send(
            partial(connection.sendall, body), partial(_raw_response, connection))
        assert response.status == 401, (response.status, response_body)
    finally:
        connection.close()
    assert api.sql("SELECT count(*) FROM publications WHERE project_id='" + project["id"] + "' AND state='ready'") == "0"
    print("PASS in-flight token revocation rejects a fully validated plan")


def _raw_response(connection):
    response = http.client.HTTPResponse(connection)
    response.begin()
    return response
