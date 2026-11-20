"""Viewer integration smoke using a real API, Postgres and accepted fixture bytes."""

import json
from pathlib import Path
import sys
import urllib.parse

from publication_exchange import ENVELOPE, MARKER, current_only_files, plan, plan_archive, publish, reason, with_marker
from publication_smoke_support import files_from_tar, project_and_token
from smoke_support import Api
from viewer_sha_smoke import sha_contract
from viewer_observation_smoke import retained_observations
from viewer_index_smoke import index_screens


def page(api, path, owner, limit=1):
    items = []
    cursor = None
    seen = set()
    while True:
        query = {"limit": limit}
        if cursor:
            assert cursor not in seen
            seen.add(cursor)
            query["cursor"] = cursor
        result, _ = api.call("GET", path + "?" + urllib.parse.urlencode(query), session=owner)
        assert len(result["items"]) <= limit
        items.extend(result["items"])
        cursor = result["nextCursor"]
        if cursor is None:
            return items


def provider_observations(api, project):
    """Database fixtures model persisted GitHub observations, never production seeds."""
    repository = api.sql(
        "SELECT repository_id FROM github_project_repositories WHERE project_id='" + project["id"] + "'")
    assert repository, "every project links an installed repository"
    api.sql(f"""
        INSERT INTO github_branches VALUES
          ('{repository}', 'zeta', repeat('a', 40), '2026-09-16T00:00:00Z'),
          ('{repository}', 'alpha', repeat('a', 40), '2026-09-16T00:00:00Z'),
          ('{repository}', 'main', repeat('a', 40), '2026-09-16T00:00:00Z');
        INSERT INTO github_pull_requests
          (repository_id, number, title, open, merged, head_ref, head_sha,
           base_ref, base_sha, updated_at, author)
        VALUES
          ('{repository}', 7, 'Publish viewer', true, false, 'fixture', repeat('a',40),
           'main', repeat('b',40), '2026-09-16T00:00:00Z', 'octocat'),
          ('{repository}', 8, 'Update viewer', true, false, 'feature', repeat('c',40),
           'main', repeat('b',40), '2026-09-16T01:00:00Z', 'octocat'),
          ('{repository}', 9, 'Merged viewer', false, true, 'feature', repeat('d',40),
           'main', repeat('b',40), '2026-09-16T02:00:00Z', NULL);
    """)


def smoke(api):
    fixture = (Path(__file__).parents[2] / "crates/mkc-mokly-contract/fixtures/dogfood.tar.gz").read_bytes()
    fixture_files = files_from_tar(fixture)
    owner = api.signup()
    outsider = api.signup()
    workspace, project, token = project_and_token(api, owner, "Viewer read smoke")
    prefix = "/v1/projects/" + project["id"]
    try:
        original = publish(api, project, token["secret"], fixture_files)
        assert original["buildId"] is None
        root = prefix + "/publications/" + original["id"]
        paths = [prefix + "/branches", prefix + "/pull-requests", prefix + "/publications",
                 root, root + "/screens", root + "/share"]
        for session in [None, outsider]:
            for path in paths:
                denied, _ = api.call("GET", path, session=session, expected=404)
                assert denied["error"]["reason"] == "not-found"
        branches = page(api, prefix + "/branches", owner)
        assert [b["name"] for b in branches] == ["fixture"]
        assert branches[0]["latestPublicationId"] == original["id"]
        assert page(api, prefix + "/pull-requests", owner) == []
        provider_observations(api, project)
        branches = page(api, prefix + "/branches", owner)
        assert [b["name"] for b in branches] == ["main", "alpha", "fixture", "zeta"]
        pulls = page(api, prefix + "/pull-requests", owner)
        assert [p["number"] for p in pulls] == [8, 7, 9]
        assert pulls[1]["author"] == "octocat" and pulls[2]["author"] is None
        assert pulls[2]["state"] == "merged"
        assert pulls[1]["url"] == "https://github.com/mokly-ai/mokly-cloud/pull/7"

        files = dict(fixture_files)
        manifest = json.loads(files[ENVELOPE])
        manifest.update(headSha="e" * 40, pullRequest=7)
        files[ENVELOPE] = json.dumps(manifest).encode()
        files = with_marker(files)
        latest = publish(api, project, token["secret"], files)
        assert page(api, prefix + "/pull-requests", owner)[1]["latestPublicationId"] == latest["id"]
        files = current_only_files(files)
        files[MARKER] = json.dumps({"schemaVersion": 3, "files": [
            {"path": "missing.html", "sha256": "0" * 64, "size": 1}]}).encode()
        assert reason(plan(api, project, token["secret"], plan_archive(files), 400)) == "upload-invalid-bundle"
        history = page(api, prefix + "/publications", owner)
        assert [p["state"] for p in history] == ["failed", "ready", "ready"]
        expected_pull = {"number": 7, "title": "Publish viewer", "author": "octocat",
                         "url": "https://github.com/mokly-ai/mokly-cloud/pull/7"}
        assert history[0]["pullRequest"] == expected_pull
        assert history[1]["pullRequest"] == expected_pull
        assert history[2]["pullRequest"] is None
        origin, _ = api.call("GET", prefix + "/publications/" + latest["id"], session=owner)
        assert origin["pullRequest"] == expected_pull
        assert all(publication["buildId"] is None for publication in history)
        newest = {key: history[0][key] for key in ["id", "buildId", "state", "publishedAt", "headSha"]}
        reference_branches = page(api, prefix + "/branches", owner)
        reference_pulls = page(api, prefix + "/pull-requests", owner)
        branch_row = next(row for row in reference_branches if row["name"] == "fixture")
        pull_row = next(row for row in reference_pulls if row["number"] == 7)
        for row in [branch_row, pull_row]:
            assert row["newestPublication"] == newest
            assert row["latestPublicationId"] == latest["id"]
        assert next(row for row in reference_branches if row["name"] == "main")["newestPublication"] is None
        assert next(row for row in reference_pulls if row["number"] == 8)["newestPublication"] is None
        assert history[0]["failureCode"] == "invalid-bundle"
        assert history[0]["catalogueUrl"] is None
        assert [p["id"] for p in history[1:]] == [latest["id"], original["id"]]
        filtered, _ = api.call("GET", prefix + "/publications?branch=fixture&pullRequest=7", session=owner)
        assert len(filtered["items"]) == 2
        publication, _ = api.call("GET", root, session=owner)
        assert publication["pullRequest"] is None
        assert publication["catalogueUrl"] == original["catalogueUrl"]
        assert publication["changes"]["state"] == "available"
        assert publication["reviewId"] is None and not publication["canComment"]
        screens = page(api, root + "/screens", owner)
        assert [s["path"] for s in screens] == ["finish", "start"]
        assert all(s["views"] == [{"viewport": "desktop", "colorScheme": "light"},
                                 {"viewport": "mobile", "colorScheme": "light"}] for s in screens)
        for screen in screens:
            for view in screen["views"]:
                query = urllib.parse.urlencode({"catalogueScreen": screen["path"], "viewport": view["viewport"],
                                                "scheme": view["colorScheme"]})
                api.call("GET", root + "/share?" + query, session=owner)
        share, _ = api.call("GET", root + "/share?catalogueScreen=start&viewport=mobile&scheme=light", session=owner)
        assert share == {"url": api.origin + "/" + workspace["slug"] + "/" + project["slug"] + "/publications/" + original["id"] +
                        "?catalogueScreen=start&viewport=mobile&scheme=light", "access": "members"}
        old_share_url = share["url"]
        old_workspace_slug, old_project_slug = workspace["slug"], project["slug"]
        workspace, _ = api.call("PATCH", "/v1/workspaces/" + workspace["id"],
                          {"name": workspace["name"], "slug": old_workspace_slug[:30] + "-renamed", "version": 1}, owner)
        project, _ = api.call("PATCH", prefix,
                              {"name": project["name"], "slug": old_project_slug + "-renamed", "visibility": "private",
                               "requireApproval": False, "version": 1}, owner)
        resolved, _ = api.call("GET", "/v1/workspaces/by-slug/" + old_workspace_slug + "/projects/" + old_project_slug,
                               session=owner)
        assert resolved["id"] == project["id"]
        assert resolved["canonicalSlug"] == project["slug"] and resolved["canonicalWorkspaceSlug"] == workspace["slug"]
        publication_after_rename, _ = api.call("GET", root, session=owner)
        assert publication_after_rename["id"] == original["id"]
        renamed_share, _ = api.call("GET", root + "/share?catalogueScreen=start&viewport=mobile&scheme=light", session=owner)
        assert renamed_share["url"] != old_share_url
        assert renamed_share["url"].startswith(api.origin + "/" + workspace["slug"] + "/" + project["slug"] + "/publications/")
        assert api.sql(f"SELECT count(*) FROM catalogue_grants WHERE publication_id='{original['id']}'") == "0"
        for query in ["thread=x", "catalogueScreen=missing", "catalogueScreen=start&scheme=dark", "viewport=tablet", "catalogueScreen=start&catalogueScreen=finish"]:
            result, _ = api.call("GET", root + "/share?" + query, session=owner, expected=400)
            assert result["error"]["reason"] == "validation-failed"
        api.call("PATCH", prefix, {"name": project["name"], "slug": project["slug"], "visibility": "public", "requireApproval": False, "version": 2}, owner)
        for path in paths:
            api.call("GET", path)
        retained_observations(api, prefix, original)
        share, _ = api.call("GET", root + "/share")
        assert share["access"] == "public"
        api.sql(f"UPDATE publications SET state='expired', expired_at=now() WHERE id='{original['id']}'")
        for path in [root, root + "/screens", root + "/share"]:
            result, _ = api.call("GET", path, expected=404)
            assert result["error"]["reason"] == "not-found"
        history = page(api, prefix + "/publications", None)
        assert history[-1]["state"] == "expired" and history[-1]["catalogueUrl"] is None
        assert history[-1]["changes"] == publication["changes"]
        current_only(api, project, token, fixture_files)
        sha_contract(api, project, token, fixture_files)
        index_screens(api, project, token, fixture_files)
        print("PASS viewer reads: six operations, visibility, unions, ordering, pagination, failures, screens, canonical sharing and expired 404")
    finally:
        version = int(api.sql("SELECT version FROM organizations WHERE id='" + workspace["id"] + "'"))
        api.call("DELETE", "/v1/workspaces/" + workspace["id"],
                 {"confirmationName": workspace["name"], "version": version}, owner, 204)


def current_only(api, project, token, fixture_files):
    files = current_only_files(fixture_files)
    manifest = json.loads(files[ENVELOPE])
    manifest.update(headSha="f" * 40, branch="current-only")
    files[ENVELOPE] = json.dumps(manifest).encode()
    publication = publish(api, project, token["secret"], with_marker(files))
    path = "/v1/projects/" + project["id"] + "/publications/" + publication["id"]
    view, _ = api.call("GET", path)
    assert view["changes"] == {"state": "no-comparison", "added": None, "changed": None, "removed": None}
    api.call("GET", path + "/share?viewport=desktop&scheme=light")
    for suffix in ["/screens", "/share?catalogueScreen=start"]:
        result, _ = api.call("GET", path + suffix, expected=503)
        assert result["error"]["reason"] == "operation-unavailable"
    print("PASS current-only context and unselected share; screen metadata stays outside the comparison-only API projection")


if __name__ == "__main__":
    api = Api(sys.argv[1], isolated_database=True)
    try:
        smoke(api)
    finally:
        api.close()
