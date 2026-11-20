"""Real API process and HTTP helpers used only by the integration smoke test."""

import json
import os
import queue
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


class Api:
    origin = "http://localhost:8081"

    def __init__(self, executable, command=None, overrides=None, isolated_database=False):
        self.executable = executable
        self.blobs = tempfile.TemporaryDirectory(prefix="mkc-api-smoke-blobs-")
        database = os.environ.get("MKC_TEST_DATABASE_URL", "postgres://postgres:postgres@localhost/mkc_test")
        separator = "&" if "?" in database else "?"
        database += separator + "application_name=mkc_api_smoke"
        self.base_database = database
        self.database_schema = None
        if isolated_database:
            self.database_schema, database = create_database_schema(database)
        port = free_port()
        env = dict(os.environ, MKC_ENV="development", MKC_BIND="127.0.0.1:" + str(port),
                   MKC_API_ORIGIN="http://127.0.0.1:" + str(port),
                   MKC_DATABASE_URL=database,
                   MKC_APP_ORIGIN=self.origin, MKC_MAILER="log",
                   MKC_CATALOGUE_ORIGIN="http://localhost:8082", MKC_CATALOGUE_SIGNING_KEY="a" * 64,
                   MKC_FILE_STORE="local", MKC_FILE_STORE_ROOT=self.blobs.name)
        env.update(overrides or {})
        self.environment = env
        self.database = env["MKC_DATABASE_URL"]
        self.process = subprocess.Popen(command or [executable, "serve"], env=env, stdout=subprocess.PIPE,
                                        stderr=subprocess.STDOUT, text=True, bufsize=1)
        self.events = queue.Queue()
        self.lines = []
        def collect():
            for line in self.process.stdout:
                self.lines.append(line)
                try:
                    self.events.put(json.loads(line)["fields"])
                except (ValueError, KeyError):
                    pass
        threading.Thread(target=collect, daemon=True).start()
        self.url = "http://" + self.event("address")["address"]

    def event(self, field, expected=None):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            try:
                event = self.events.get(timeout=0.2)
            except queue.Empty:
                if self.process.poll() is not None:
                    raise AssertionError("API exited: " + "".join(self.lines))
                continue
            if field in event and (expected is None or event[field] == expected):
                return event
        raise AssertionError("Timed out waiting for " + field + ": " + "".join(self.lines))

    def call(self, method, path, body=None, session=None, expected=200, extra=None):
        headers = {"Origin": self.origin}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if session:
            headers.update({"Cookie": session["cookie"], "X-CSRF-Token": session["csrf"]})
        for name, value in (extra or {}).items():
            if value is None:
                headers.pop(name, None)
            else:
                headers[name] = value
        if isinstance(body, bytes):
            data = body
        else:
            data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.url + path, data=data, headers=headers, method=method)
        try:
            response = urllib.request.urlopen(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        text = response.read().decode()
        statuses = expected if isinstance(expected, tuple) else (expected,)
        assert response.status in statuses, (method, path, response.status, expected, text)
        assert response.headers.get("Cache-Control") == "no-store"
        if headers.get("X-Request-ID"):
            assert response.headers["X-Request-ID"] == headers["X-Request-ID"]
        else:
            assert uuid.UUID(response.headers["X-Request-ID"]).version == 4
        value = json.loads(text) if text else None
        if response.status >= 400:
            assert set(value) == {"error"}
            detail = value["error"]
            assert set(detail) in ({"code", "reason", "message", "request_id"}, {"code", "reason", "message", "request_id", "data"})
            assert detail["request_id"] == response.headers["X-Request-ID"]
            statuses = {"bad-request": 400, "failed-precondition": 400, "unauthenticated": 401,
                        "permission-denied": 403, "not-found": 404, "already-exists": 409,
                        "resource-exhausted": 429, "payload-too-large": 413, "internal": 500, "unavailable": 503}
            assert statuses[detail["code"]] == response.status
            assert "[mkc-" not in detail["message"]
        return value, response.headers

    def signup(self, email=None):
        email = email or (str(uuid.uuid4()) + "@example.com")
        result, _ = self.call("POST", "/v1/auth/magic-links", {"email": email, "returnTo": "/mokly/cloud?view=changes"}, expected=202)
        assert set(result) == {"requestId", "resendAfter"}
        link = self.event("recipient", email)["link"]
        assert link.startswith(self.origin + "/auth/email/callback#token=")
        secret = link.split("#token=")[1]
        result, headers = self.call("POST", "/v1/auth/callback", {"token": secret})
        assert result["returnTo"] == "/mokly/cloud?view=changes"
        cookie = headers["Set-Cookie"]
        for attribute in ["Secure", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=2592000"]:
            assert attribute in cookie
        assert "Domain=" not in cookie
        error, _ = self.call("POST", "/v1/auth/callback", {"token": secret}, expected=400)
        assert error["error"]["reason"] == "magic-link-used"
        return {"cookie": cookie.split(";")[0], "csrf": result["session"]["csrfToken"],
                "user": result["session"]["user"], "email": email}

    def sql(self, statement):
        return subprocess.check_output(["psql", self.database, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement], text=True, timeout=10).strip()

    def installed_repository(self, workspace, full_name="mokly-ai/mokly"):
        """Reuse this account's installation, or bind another GitHub account."""
        account = full_name.split("/", 1)[0].replace("'", "''")
        installation = self.sql(
            f"SELECT id FROM github_installations WHERE organization_id='{workspace}' "
            f"AND account_name='{account}' ORDER BY id LIMIT 1")
        repository = str(uuid.uuid4())
        provider = uuid.uuid4().int % (2**62) + 1
        if not installation:
            installation = str(uuid.uuid4())
            self.sql(f"""
                INSERT INTO github_installations
                  (id, github_id, app_id, organization_id, account_id, account_name,
                   account_kind, manage_url, active, connected, updated_at)
                VALUES ('{installation}', {provider}, 1, '{workspace}', {provider}, '{account}',
                        'organization', 'https://github.com/settings/installations/1',
                        true, true, now());
            """)
        self.sql(f"""
            INSERT INTO github_repositories
              (id, installation_id, github_id, full_name, default_branch, private, active)
            VALUES ('{repository}', '{installation}', {provider}, '{full_name}', 'main', true, true);
        """)
        return repository

    def close(self):
        self.process.terminate()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)

        try:
            if self.database_schema:
                subprocess.run(
                    ["psql", self.base_database, "-X", "-v", "ON_ERROR_STOP=1", "-c",
                     "DROP SCHEMA " + self.database_schema + " CASCADE"],
                    check=True, timeout=10, stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
        finally:
            self.blobs.cleanup()

    def registered_routes(self):
        document = json.loads(subprocess.check_output(
            [self.executable, "openapi"], env=self.environment, text=True, timeout=30,
        ))
        return [
            {"method": method.upper(), "path": path,
             "operationId": operation["operationId"], "implemented": False}
            for path, item in document["paths"].items()
            for method, operation in item.items()
            if isinstance(operation, dict) and operation.get("x-deferred") is True
        ]


def free_port():
    """Reserve a loopback port number so the API knows its own origin before it binds."""
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def create_database_schema(database):
    """Create one disposable schema and return its name and search-path URL."""
    schema = "api_smoke_" + uuid.uuid4().hex
    subprocess.run(
        ["psql", database, "-X", "-v", "ON_ERROR_STOP=1", "-c", "CREATE SCHEMA " + schema],
        check=True, timeout=10, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    parsed = urllib.parse.urlsplit(database)
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    options = [value for key, value in query if key == "options"]
    query = [(key, value) for key, value in query if key != "options"]
    query.append(("options", " ".join(options + ["-csearch_path=" + schema])))
    isolated = urllib.parse.urlunsplit(parsed._replace(query=urllib.parse.urlencode(query)))
    return schema, isolated
