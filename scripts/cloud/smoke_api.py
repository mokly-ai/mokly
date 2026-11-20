"""Platform lifecycle smoke, invoked by the Rust integration test."""

import hashlib
import secrets
import sys
import uuid

from smoke_support import Api
from smoke_concurrency import concurrency
from smoke_permissions import permissions
from smoke_cli_project import cli_project


def preview_sign_in(api, secret, email, previous):
    key = hashlib.sha256(b"preview:127.0.0.1").hexdigest()
    api.sql("DELETE FROM auth_rate_limits WHERE key='" + key + "'")
    wrong = ("0" if secret[0] != "0" else "1") + secret[1:]
    for refused in ["bad", wrong]:
        error, _ = api.call("POST", "/v1/auth/preview", {"secret": refused}, expected=400)
        assert error["error"]["reason"] == "magic-link-invalid"
    for body, origin, expected in [
        (b"{", api.origin, 400),
        ({"secret": secret}, None, 403),
        ({"secret": secret}, "https://wrong.example.com", 403),
        ({"secret": secret, "unexpected": True}, api.origin, 400),
    ]:
        error, _ = api.call("POST", "/v1/auth/preview", body, expected=expected,
                            extra={"Origin": origin})
        expected_reason = "validation-failed" if expected == 400 else "csrf-rejected"
        assert error["error"]["reason"] == expected_reason
        assert api.sql("SELECT count FROM auth_rate_limits WHERE key='" + key + "'") == "2"
    issued, headers = api.call("POST", "/v1/auth/preview", {"secret": secret}, session=previous)
    assert issued["returnTo"] == "/dashboard"
    assert issued["session"]["user"]["email"] == email
    cookie = headers["Set-Cookie"]
    for attribute in ["Secure", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=2592000"]:
        assert attribute in cookie
    assert "Domain=" not in cookie
    api.call("GET", "/v1/session", session=previous, expected=401)
    session = {"cookie": cookie.split(";")[0], "csrf": issued["session"]["csrfToken"],
               "user": issued["session"]["user"], "email": email}
    api.call("GET", "/v1/session", session=session)
    assert api.sql("SELECT count FROM auth_rate_limits WHERE key='" + key + "'") == "3"
    for _ in range(17):
        api.call("POST", "/v1/auth/preview", {"secret": wrong}, expected=400)
    error, limited_headers = api.call("POST", "/v1/auth/preview", {"secret": secret}, expected=429)
    assert error["error"]["reason"] == "rate-limited"
    assert int(limited_headers["Retry-After"]) > 0
    return session


def unconfigured_optional_operations(api):
    for path, valid_body in [
        ("/v1/auth/preview", {"secret": "a" * 64}),
        ("/v1/auth/github", {}),
    ]:
        for body, origin in [
            (b"{", api.origin),
            (valid_body, None),
            (valid_body, "https://wrong.example.com"),
        ]:
            error, _ = api.call("POST", path, body, expected=503, extra={"Origin": origin})
            assert error["error"]["reason"] == "operation-unavailable"


def smoke(api):
    health, headers = api.call("GET", "/v1/health")
    assert health["status"] == "ok" and health["migrations"] == "current"
    assert health["version"] and health["revision"]
    assert headers.get("Cache-Control") == "no-store"
    assert headers.get("Set-Cookie") is None
    owner = api.signup()
    stranger = api.signup()
    stranger = preview_sign_in(api, api.environment["MKC_PREVIEW_SIGN_IN_SECRET"],
                               api.environment["MKC_PREVIEW_SIGN_IN_EMAIL"], stranger)
    session, _ = api.call("GET", "/v1/session", session=owner)
    assert session["user"]["email"] == owner["email"]
    assert session["workspaceIds"] == []
    api.call("POST", "/v1/auth/magic-links", {"email": owner["email"]}, expected=429)
    api.call("POST", "/v1/auth/magic-links", {"email": "invalid"}, expected=400)
    api.call("POST", "/v1/auth/magic-links", {"email": "a@example.com"}, expected=403, extra={"Origin": "https://evil.test"})
    api.call("GET", "/v1/session", expected=401)
    request_id = str(uuid.uuid4())
    error, _ = api.call("GET", "/v1/missing", expected=404, extra={"X-Request-ID": request_id})
    assert error["error"]["request_id"] == request_id
    event = api.event("reason", "not-found")
    assert request_id in event["request_id"] and event["is_request_error"]
    api.call("GET", "/v1/session", session=owner, extra={"X-Request-ID": request_id})
    api.call("GET", "/v1/missing", expected=404, extra={"X-Request-ID": ""})
    api.call("OPTIONS", "/v1/session", extra={"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-csrf-token,x-request-id"})
    api.call("PUT", "/v1/session", expected=400)
    for csrf in ["wrong", ""]:
        api.call("POST", "/v1/workspaces", {"name": "Team", "slug": "team"}, owner, 403, {"X-CSRF-Token": csrf})
    api.call("POST", "/v1/workspaces", {"name": "Team", "slug": "team"}, owner, 403, {"Origin": "null"})
    api.call("POST", "/v1/workspaces", {"name": "Team", "slug": "team", "unknown": True}, owner, 400)
    api.call("POST", "/v1/workspaces", {"name": "x" * 20000, "slug": "team"}, owner, 413)
    suggested, _ = api.call("GET", "/v1/workspaces/slug-suggestion?name=Team", session=owner)
    assert suggested == {"slug": "team-2"}
    reserved, _ = api.call("POST", "/v1/workspaces", {"name": "Docs", "slug": "docs"}, owner, 400)
    assert reserved["error"]["reason"] == "slug-reserved"
    assert reserved["error"]["data"] == {"field": "slug", "suggestedSlug": "docs-2"}
    api.call("POST", "/v1/workspaces", {"name": "UUID", "slug": "00000000-0000-0000-0000-000000000001"}, owner, 400)
    workspace, _ = api.call("POST", "/v1/workspaces", {"name": " Team ", "slug": "acme"}, owner, 201)
    workspace_id = workspace["id"]
    assert uuid.UUID(workspace_id).version == 7
    assert workspace["name"] == "Team" and workspace["slug"] == "acme"
    assert workspace["role"] == "owner" and workspace["plan"] == "free"
    workspace_path = "/v1/workspaces/" + workspace_id
    error, _ = api.call("GET", workspace_path + "/billing", session=owner, expected=503)
    assert error["error"]["reason"] == "operation-unavailable"
    for signature in [None, "t=1,v1=" + "0" * 64]:
        extra = {} if signature is None else {"Stripe-Signature": signature}
        error, _ = api.call(
            "POST",
            "/v1/billing/webhooks",
            {"id": "evt_unconfigured", "type": "invoice.paid", "created": 1},
            expected=503,
            extra=extra,
        )
        assert error["error"]["reason"] == "operation-unavailable"
    api.call("GET", workspace_path, session=stranger, expected=404)
    api.call("GET", "/v1/workspaces/by-slug/acme", session=stranger, expected=404)
    api.call("GET", "/v1/workspaces/by-slug/missing", session=owner, expected=404)
    api.call("GET", "/v1/workspaces/by-slug/acme/projects/missing", session=owner, expected=404)
    api.call("GET", "/v1/workspaces/not-a-uuid", session=owner, expected=400)
    workspace, _ = api.call("PATCH", workspace_path, {"name": "Team renamed", "slug": "acme-renamed", "version": 1}, owner)
    old_workspace, _ = api.call("GET", "/v1/workspaces/by-slug/acme", session=owner)
    assert old_workspace["id"] == workspace_id and old_workspace["slug"] == "acme-renamed" and old_workspace["canonicalSlug"] == "acme-renamed"
    error, _ = api.call("PATCH", workspace_path, {"name": "stale", "slug": "stale", "version": 1}, owner, 400)
    assert error["error"]["data"]["currentVersion"] == 2
    taken, _ = api.call("POST", "/v1/workspaces", {"name": "Taken", "slug": "acme"}, owner, 409)
    assert taken["error"]["reason"] == "slug-taken" and taken["error"]["data"]["field"] == "slug"
    workspace, _ = api.call("PATCH", workspace_path, {"name": "Team renamed", "slug": "acme", "version": 2}, owner)
    old_workspace, _ = api.call("GET", "/v1/workspaces/by-slug/acme-renamed", session=owner)
    assert old_workspace["canonicalSlug"] == "acme" and workspace["version"] == 3
    members, _ = api.call("GET", workspace_path + "/members", session=owner)
    member_id = members["items"][0]["id"]
    error, _ = api.call("PATCH", workspace_path + "/members/" + member_id, {"role": "admin", "version": 1}, owner, 400)
    assert error["error"]["reason"] == "last-owner"
    api.call("DELETE", workspace_path + "/members/" + member_id, {"version": 1}, owner, 400)
    api.call("PATCH", "/v1/account", {"name": "Test owner"}, owner)
    repository = api.installed_repository(workspace_id)
    cli_project(api, owner, workspace_id)
    api.call("POST", workspace_path + "/projects", {"name": "Catalogue", "slug": "mokly", "configPath": "mokly.config.json"}, owner, 400)
    api.call("POST", workspace_path + "/projects", {"name": "Catalogue", "slug": "mokly", "repositoryId": str(uuid.uuid4()), "configPath": "mokly.config.json"}, owner, 404)
    suggested, _ = api.call("GET", workspace_path + "/projects/slug-suggestion?repository=mokly-ai%2Fmokly&configPath=mokly.config.json", session=owner)
    assert suggested == {"slug": "mokly"}
    project_input = {"name": "Catalogue", "slug": "mokly", "repositoryId": repository, "configPath": "mokly.config.json"}
    project, _ = api.call("POST", workspace_path + "/projects", project_input, owner, 201)
    assert project["repository"] == "mokly-ai/mokly"
    assert api.sql("SELECT repository_id FROM github_project_repositories WHERE project_id='" + project["id"] + "'") == repository
    project_path = "/v1/projects/" + project["id"]
    assert project["slug"] == "mokly" and project["workspaceSlug"] == "acme"
    assert project["requireApproval"] is False and project["visibility"] == "public"
    assert api.sql("SELECT require_approval FROM projects WHERE id='" + project["id"] + "'") == "f"
    grants, _ = api.call("GET", project_path + "/members", session=owner)
    inherited = [grant for grant in grants["items"] if grant["inherited"]]
    direct = [grant for grant in grants["items"] if not grant["inherited"]]
    assert inherited and all(grant["id"] is None and "version" not in grant for grant in inherited)
    assert direct and all(grant["id"] is not None and grant["version"] == 1 for grant in direct)
    error, _ = api.call("POST", workspace_path + "/projects", project_input, owner, 409)
    assert error["error"]["data"]["existingProjectId"] == project["id"]
    api.call("POST", workspace_path + "/projects", dict(project_input, configPath="../bad.json"), owner, 400)
    for session in [stranger, None]:
        public_project, _ = api.call("GET", project_path, session=session)
        assert public_project["canAdmin"] is False
    project, _ = api.call("PATCH", project_path, {"name": "Catalogue", "slug": "website", "visibility": "public", "requireApproval": False, "version": 1}, owner)
    old_project_path = "/v1/workspaces/by-slug/acme/projects/mokly"
    old_project, _ = api.call("GET", old_project_path)
    assert old_project["canonicalSlug"] == "website" and old_project["canonicalWorkspaceSlug"] == "acme"
    other = api.installed_repository(workspace_id, "mokly-ai/other")
    conflict_input = {"name": "Other", "slug": "mokly", "repositoryId": other, "configPath": "other.json"}
    taken, _ = api.call("POST", workspace_path + "/projects", conflict_input, owner, 409)
    assert taken["error"]["reason"] == "slug-taken" and taken["error"]["data"]["suggestedSlug"] == "mokly-2"
    project, _ = api.call("PATCH", project_path, {"name": "Catalogue", "slug": "mokly", "visibility": "public", "requireApproval": False, "version": 2}, owner)
    retired_project, _ = api.call("GET", "/v1/workspaces/by-slug/acme-renamed/projects/website")
    assert retired_project["canonicalSlug"] == "mokly" and retired_project["canonicalWorkspaceSlug"] == "acme"
    created, _ = api.call("POST", project_path + "/tokens", {"name": "CI"}, owner, 201)
    secret = created["secret"]
    assert secret.startswith("mkc_") and len(secret) == 68
    token_id = created["token"]["id"]
    stored = api.sql("SELECT token_hash FROM project_tokens WHERE id = '" + token_id + "'")
    assert stored == hashlib.sha256(secret.encode()).hexdigest() and secret != stored
    tokens, _ = api.call("GET", project_path + "/tokens", session=owner)
    assert "secret" not in str(tokens) and stored not in str(tokens) and secret not in str(tokens)
    api.call("DELETE", project_path + "/tokens/" + token_id, session=owner, expected=204)
    api.call("DELETE", project_path + "/tokens/" + token_id, session=owner, expected=204)
    tokens, _ = api.call("GET", project_path + "/tokens", session=owner)
    assert tokens["items"][0]["revoked"]
    private_settings = {"name": "Catalogue", "slug": "mokly", "visibility": "private", "requireApproval": False, "version": 3}
    error, _ = api.call("PATCH", project_path, private_settings, owner, 400)
    assert error["error"]["reason"] == "plan-required"
    assert error["error"]["data"] == {"requiredPlan": "team", "feature": "private-projects"}
    api.sql("UPDATE organizations SET plan='team' WHERE id='" + workspace_id + "'")
    private, _ = api.call("PATCH", project_path, private_settings, owner)
    assert private["visibility"] == "private" and private["version"] == 4
    api.call("GET", project_path, expected=404)
    permissions(api, owner, stranger, workspace_path, project_path, repository)
    concurrency(api, owner)
    settings = {"name": "Catalogue", "slug": "mokly", "visibility": "public", "requireApproval": False, "version": 4}
    api.call("PATCH", project_path, settings, owner)
    public, _ = api.call("GET", project_path)
    assert public["canAdmin"] is False
    api.call("GET", project_path + "/tokens", expected=401)
    api.call("PATCH", project_path, dict(settings, visibility="private", version=5), owner)
    api.call("GET", project_path, expected=404)
    api.call("PATCH", project_path, dict(settings, visibility="private", requireApproval=True, version=6), owner, 503)
    api.call("GET", workspace_path + "/projects?limit=0", session=owner, expected=400)
    api.call("GET", workspace_path + "/projects?cursor=invalid", session=owner, expected=400)
    api.call("GET", workspace_path + "/projects?limit=1&limit=2", session=owner, expected=400)
    taken, _ = api.call("POST", "/v1/workspaces", {"name": "Retired", "slug": "acme-renamed"}, owner, 409)
    assert taken["error"]["reason"] == "slug-taken"
    workspace2, _ = api.call("POST", "/v1/workspaces", {"name": "Second", "slug": "second"}, owner, 201)
    first, _ = api.call("GET", "/v1/workspaces?limit=1", session=owner)
    assert first["nextCursor"]
    second, _ = api.call("GET", "/v1/workspaces?limit=1&cursor=" + first["nextCursor"], session=owner)
    assert first["items"][0]["id"] != second["items"][0]["id"]
    api.call("DELETE", project_path, {"confirmationName": "wrong", "version": 6}, owner, 400)
    api.call("DELETE", project_path, {"confirmationName": "Catalogue", "version": 6}, owner, 204)
    assert api.sql("SELECT count(*) FROM project_tokens WHERE id='" + token_id + "'") == "0"
    assert api.sql("SELECT count(*) FROM project_slugs WHERE project_id='" + project["id"] + "'") == "0"
    api.call("GET", project_path, session=owner, expected=404)
    for route in api.registered_routes():
        if not route["implemented"]:
            path = route["path"]
            for name in ["installationId", "projectId", "publicationId", "threadId", "commentId", "reviewId", "approvalId"]:
                path = path.replace("{" + name + "}", str(uuid.uuid4()))
            error, _ = api.call(route["method"], path, expected=503)
            assert error["error"]["reason"] == "operation-unavailable"
    rotated, headers = api.call("POST", "/v1/session", session=owner)
    api.call("GET", "/v1/session", session=owner, expected=401)
    owner.update(cookie=headers["Set-Cookie"].split(";")[0], csrf=rotated["csrfToken"])
    api.call("DELETE", workspace_path, {"confirmationName": "Team renamed", "version": 3}, owner, 204)
    assert api.sql("SELECT count(*) FROM organization_slugs WHERE organization_id='" + workspace_id + "'") == "0"
    api.call("DELETE", "/v1/workspaces/" + workspace2["id"], {"confirmationName": "Second", "version": 1}, owner, 204)
    digest = hashlib.sha256(stranger["cookie"].split("=")[1].encode()).hexdigest()
    api.sql("UPDATE sessions SET expires_at=now() WHERE token_hash='" + digest + "'")
    error, _ = api.call("GET", "/v1/session", session=stranger, expected=401)
    assert error["error"]["reason"] == "session-expired"
    api.call("DELETE", "/v1/session", session=owner, expected=204)
    api.call("GET", "/v1/session", session=owner, expected=401)
    print("PASS API smoke: preview and email sign-in, CSRF, roles, invitations, grants, projects, hash-only tokens, pagination, lifecycle, deferred routes, rotation and sign-out")


if __name__ == "__main__":
    preview_secret = secrets.token_hex(32)
    preview_email = "preview-" + str(uuid.uuid4()) + "@example.com"
    api = Api(sys.argv[1], overrides={"MKC_PREVIEW_SIGN_IN_SECRET": preview_secret,
                                     "MKC_PREVIEW_SIGN_IN_EMAIL": preview_email})
    try:
        smoke(api)
    finally:
        api.close()
    api = Api(sys.argv[1])
    try:
        unconfigured_optional_operations(api)
    finally:
        api.close()
