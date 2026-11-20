"""Invitation, authorization and concurrency scenarios for the API smoke."""

from concurrent.futures import ThreadPoolExecutor
import hashlib
import uuid


def permissions(api, owner, guest, workspace_path, project_path, repository):
    invite, _ = api.call("POST", workspace_path + "/members", {"email": guest["email"], "role": "reviewer"}, owner, 201)
    invite_path = workspace_path + "/members/" + invite["id"]
    accept = workspace_path + "/invitations/" + invite["id"] + "/accept"
    assert api.event("recipient", guest["email"])["link"] == api.origin + accept.removeprefix("/v1")
    api.call("POST", accept, session=owner, expected=404)
    active, _ = api.call("POST", accept, session=guest)
    assert active["status"] == "active" and active["version"] == 2
    api.call("POST", accept, session=guest)
    api.call("GET", project_path, session=guest)
    api.call("GET", workspace_path + "/members", session=guest, expected=403)
    api.call("POST", workspace_path + "/projects", {"name": "Denied", "slug": "denied", "repositoryId": repository, "configPath": "other.json"}, guest, 403)
    api.call("POST", project_path + "/tokens", {"name": "Denied"}, guest, 403)
    api.call("POST", workspace_path + "/members", {"email": "another@example.com", "role": "owner"}, owner, 400)
    api.call("POST", workspace_path + "/members", {"email": guest["email"], "role": "reviewer"}, owner, 409)
    grant, _ = api.call("POST", project_path + "/members", {"userId": guest["user"]["id"], "role": "admin"}, owner, 201)
    api.call("GET", project_path + "/tokens", session=guest)
    grants, _ = api.call("GET", project_path + "/members", session=owner)
    assert any(row["inherited"] and row["userId"] == guest["user"]["id"] for row in grants["items"])
    grant_path = project_path + "/members/" + grant["id"]
    api.call("PATCH", grant_path, {"role": "member", "version": 1}, owner)
    api.call("GET", project_path + "/tokens", session=guest, expected=403)
    api.call("DELETE", grant_path, {"version": 1}, owner, 400)
    api.call("DELETE", grant_path, {"version": 2}, owner, 204)
    api.call("GET", project_path, session=guest)
    api.call("PATCH", invite_path, {"role": "member", "version": 2}, owner)
    child, _ = api.call("POST", workspace_path + "/projects", {"name": "Member project", "slug": "member-project", "repositoryId": repository, "configPath": "other.json"}, guest, 201)
    assert child["canAdmin"]
    child_path = "/v1/projects/" + child["id"]
    api.call("DELETE", child_path + "/members/" + grant["id"], {"version": 2}, owner, 404)
    api.call("DELETE", child_path, {"confirmationName": "Member project", "version": 1}, guest, 204)
    api.call("DELETE", invite_path, {"version": 3}, owner, 204)
    api.call("GET", project_path, session=guest, expected=404)
    grant, _ = api.call("POST", project_path + "/members", {"userId": guest["user"]["id"], "role": "reviewer"}, owner, 201)
    guest_project, _ = api.call("GET", project_path, session=guest)
    assert guest_project["workspaceSlug"] == "acme"
    guest_slug_project, _ = api.call("GET", "/v1/workspaces/by-slug/acme/projects/mokly", session=guest)
    assert guest_slug_project["id"] == guest_project["id"] and guest_slug_project["canonicalWorkspaceSlug"] == "acme"
    api.call("GET", workspace_path, session=guest, expected=404)
    api.call("GET", "/v1/workspaces/by-slug/acme", session=guest, expected=404)
    api.call("DELETE", project_path + "/members/" + grant["id"], {"version": 1}, owner, 204)
    expired, _ = api.call("POST", workspace_path + "/members", {"email": guest["email"], "role": "admin"}, owner, 201)
    api.sql("UPDATE memberships SET expires_at = now() - interval '1 second' WHERE id = '" + expired["id"] + "'")
    api.call("POST", workspace_path + "/invitations/" + expired["id"] + "/accept", session=guest, expected=400)
    replacement, _ = api.call("POST", workspace_path + "/members", {"email": guest["email"], "role": "admin"}, owner, 201)
    assert replacement["id"] != expired["id"]
    api.call("DELETE", workspace_path + "/members/" + replacement["id"], {"version": 1}, owner, 204)
    owner_race(api, owner, guest)
    link_race(api)


def owner_race(api, owner, guest):
    workspace, _ = api.call("POST", "/v1/workspaces", {"name": "Owner race", "slug": "owner-race"}, owner, 201)
    path = "/v1/workspaces/" + workspace["id"]
    invite, _ = api.call("POST", path + "/members", {"email": guest["email"], "role": "admin"}, owner, 201)
    api.call("POST", path + "/invitations/" + invite["id"] + "/accept", session=guest)
    api.call("PATCH", path + "/members/" + invite["id"], {"role": "owner", "version": 2}, guest, 403)
    api.call("PATCH", path + "/members/" + invite["id"], {"role": "owner", "version": 2}, owner)
    members, _ = api.call("GET", path + "/members", session=owner)
    records = {m["email"]: m for m in members["items"]}
    def demote(actor):
        member = records[actor["email"]]
        return api.call("PATCH", path + "/members/" + member["id"], {"role": "admin", "version": member["version"]}, actor, (200, 400))[0]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(demote, [owner, guest]))
    assert sum(row.get("error", {}).get("reason") == "last-owner" for row in results) == 1, results
    assert api.sql("SELECT count(*) FROM memberships WHERE organization_id='" + workspace["id"] + "' AND role='owner'") == "1"
    survivor = owner if results[0].get("error", {}).get("reason") == "last-owner" else guest
    api.call("DELETE", path, {"confirmationName": "Owner race", "version": 1}, survivor, 204)


def link_race(api):
    email = str(uuid.uuid4()) + "@example.com"
    api.call("POST", "/v1/auth/magic-links", {"email": email}, expected=202)
    secret = api.event("recipient", email)["link"].split("#token=")[1]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: api.call("POST", "/v1/auth/callback", {"token": secret}, expected=(200, 400))[0], range(2)))
    assert sum(row.get("error", {}).get("reason") == "magic-link-used" for row in results) == 1, results
    email = str(uuid.uuid4()) + "@example.com"
    api.call("POST", "/v1/auth/magic-links", {"email": email}, expected=202)
    secret = api.event("recipient", email)["link"].split("#token=")[1]
    digest = hashlib.sha256(secret.encode()).hexdigest()
    api.sql("UPDATE magic_links SET expires_at = now() - interval '1 second' WHERE token_hash='" + digest + "'")
    error, _ = api.call("POST", "/v1/auth/callback", {"token": secret}, expected=400)
    assert error["error"]["reason"] == "magic-link-expired"
