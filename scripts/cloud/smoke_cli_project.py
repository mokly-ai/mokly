"""A project without a repository link and a second installed GitHub account."""


def cli_project(api, owner, workspace_id):
    path = f"/v1/workspaces/{workspace_id}/projects"
    created, _ = api.call(
        "POST", path,
        {"name": "CLI catalogue", "slug": "cli-catalogue",
         "repository": "gitlab.com/Smoke/Catalogue.git", "configPath": "mokly.config.json"},
        owner, 201,
    )
    assert created["repository"] == "gitlab.com/smoke/catalogue"
    assert created["automaticBuilds"] is False
    assert created["buildsAvailable"] is False
    assert created["canRequestBuilds"] is False
    assert created["visibility"] == "public"
    project_id = created["id"]
    assert api.sql(
        f"SELECT count(*) FROM github_project_repositories WHERE project_id='{project_id}'"
    ) == "0"
    duplicate, _ = api.call(
        "POST", path,
        {"name": "Duplicate", "slug": "duplicate-cli",
         "repository": "gitlab.com/SMOKE/CATALOGUE", "configPath": "mokly.config.json"},
        owner, 409,
    )
    assert duplicate["error"]["data"]["existingProjectId"] == project_id
    repository = api.installed_repository(workspace_id, "another-account/catalogue")
    assert repository
    assert api.sql(
        f"SELECT count(*) FROM github_installations WHERE organization_id='{workspace_id}'"
    ) == "2"
    api.call(
        "DELETE", f"/v1/projects/{project_id}",
        {"confirmationName": "CLI catalogue", "version": 1}, owner, 204,
    )
