"""Initial preview-account plans through the real API and isolated Postgres."""

import secrets
import sys
import uuid

from smoke_support import Api


def create_catalogue_project(api, session, slug, expected_plan, expected_visibility):
    workspace, _ = api.call(
        "POST", "/v1/workspaces", {"name": "Preview plan", "slug": slug}, session, 201
    )
    workspace_path = "/v1/workspaces/" + workspace["id"]
    assert workspace["plan"] == expected_plan, workspace
    read, _ = api.call("GET", workspace_path, session=session)
    assert read["plan"] == expected_plan, read
    repository = api.installed_repository(workspace["id"], "mokly-ai/mokly-cloud")
    project, _ = api.call(
        "POST", workspace_path + "/projects",
        {"name": "Catalogue", "slug": "catalogue", "repositoryId": repository,
         "configPath": "mokly.config.json"}, session, 201,
    )
    assert project["visibility"] == expected_visibility, project
    read, _ = api.call("GET", "/v1/projects/" + project["id"], session=session)
    assert read["visibility"] == expected_visibility, read
    assert read["publishingAllowed"] is True
    assert api.sql("SELECT count(*) FROM billing_subscriptions") == "0"
    unavailable, _ = api.call("GET", workspace_path + "/billing", session=session, expected=503)
    assert unavailable["error"]["reason"] == "operation-unavailable"
    return workspace_path


def preview_plan(executable, plan):
    secret = secrets.token_hex(32)
    email = "preview-" + str(uuid.uuid4()) + "@example.com"
    settings = {"MKC_PREVIEW_SIGN_IN_SECRET": secret,
                "MKC_PREVIEW_SIGN_IN_EMAIL": " " + email.upper() + " "}
    if plan is not None:
        settings["MKC_PREVIEW_SIGN_IN_PLAN"] = plan
    api = Api(executable, overrides=settings, isolated_database=True)
    try:
        issued, headers = api.call("POST", "/v1/auth/preview", {"secret": secret})
        assert issued["session"]["user"]["email"] == email
        preview = {"cookie": headers["Set-Cookie"].split(";")[0],
                   "csrf": issued["session"]["csrfToken"]}
        expected = plan or "free"
        workspace_path = create_catalogue_project(
            api, preview, "preview-team", expected,
            "private" if expected == "team" else "public",
        )
        other = api.signup()
        create_catalogue_project(api, other, "other-team", "free", "public")
        # The initial-plan rule never resets the plan of an existing workspace.
        api.sql("UPDATE organizations SET plan='free' WHERE id='" + workspace_path.rsplit("/", 1)[1] + "'")
        renamed, _ = api.call("PATCH", workspace_path,
                             {"name": "Renamed", "slug": "preview-team", "version": 1}, preview)
        assert renamed["plan"] == "free"
        print("PASS preview plan: " + str(plan) + "; creator scope, defaults, reads, no subscription, existing plan")
    finally:
        api.close()


if __name__ == "__main__":
    for value in ("team", "free", None):
        preview_plan(sys.argv[1], value)
