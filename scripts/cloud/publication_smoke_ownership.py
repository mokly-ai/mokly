"""Project-owned blob isolation across ingest, serving and collection."""

from pathlib import Path
import subprocess
import uuid

from publication_exchange import artifact_names, complete, digest as sha256, plan, plan_archive, put_blob
from publication_smoke_support import project_and_token


def foreign_attempt(api, primary, planned):
    """Another project's attempt id is indistinguishable from an unknown one."""
    target = planned["missing"][0]
    for attempt in [planned["upload"]["id"], str(uuid.uuid4())]:
        path = ("/v1/projects/" + primary["project"]["id"] + "/publication-uploads/" + attempt +
                "/blobs/" + target)
        rejected = put_blob(api, planned, primary["token"]["secret"], target, b"", 404, path=path)
        assert rejected["error"]["reason"] == "not-found"


def project_owned_copies(api, catalogue, owner, primary, files, executable):
    """`primary` holds the first project's ready publication, project and token."""
    digest = sha256(files["index.html"])
    workspace, project, token = project_and_token(api, owner, "Second publication fixture")
    deleted = False
    try:
        planned = plan(api, project, token["secret"], plan_archive(files))
        artifacts = {sha256(files[name]) for name in artifact_names(files)}
        declared = {sha256(data) for data in files.values()} - artifacts
        assert set(planned["missing"]) == declared, "a new project stores its own copy of every file"
        foreign_attempt(api, primary, planned)
        contents = {sha256(data): data for data in files.values()}
        for value in planned["missing"]:
            put_blob(api, planned, token["secret"], value, contents[value])
        publication = complete(api, planned, token["secret"])
        event = api.event("publication_id", publication["id"])
        assert event["missing"] == len(declared)
        assert event["written"] == len(artifacts)
        assert api.sql(
            "SELECT count(*) FROM blobs WHERE hash='" + digest + "'"
        ) == "2"
        assert api.sql(
            "SELECT count(DISTINCT project_id) FROM blobs WHERE hash='" + digest + "'"
        ) == "2"
        assert api.sql(
            "SELECT count(DISTINCT incarnation) FROM blobs WHERE hash='" + digest + "'"
        ) == "2"
        object_paths = list(Path(api.blobs.name).glob("sha256/" + digest + "/*"))
        assert len(object_paths) == 2, object_paths

        api.call(
            "PATCH",
            "/v1/projects/" + project["id"],
            {"name": project["name"], "slug": project["slug"], "visibility": "public",
             "requireApproval": False, "version": 1},
            owner,
        )
        for candidate in [primary["publication"], publication]:
            body, _ = catalogue.fetch(candidate, "/index.html")
            assert body == files["index.html"]

        api.call(
            "DELETE",
            "/v1/workspaces/" + workspace["id"],
            {"confirmationName": workspace["name"], "version": 1},
            owner,
            204,
        )
        deleted = True
        assert api.sql(
            "SELECT count(*) FROM blobs WHERE hash='" + digest + "' AND ref_count=0"
        ) == "1"
        subprocess.run(
            [executable, "--exact", "publication_garbage_process", "--nocapture"],
            env=dict(api.environment, MKC_SMOKE_PROCESS="garbage"),
            check=True,
            timeout=30,
        )
        assert api.sql(
            "SELECT count(*) FROM blobs WHERE hash='" + digest + "'"
        ) == "1"
        assert len(list(Path(api.blobs.name).glob("sha256/" + digest + "/*"))) == 1
        body, _ = catalogue.fetch(primary["publication"], "/index.html")
        assert body == files["index.html"]
        catalogue.fetch(publication, "/index.html", expected=404)
    finally:
        if not deleted:
            api.call(
                "DELETE",
                "/v1/workspaces/" + workspace["id"],
                {"confirmationName": workspace["name"], "version": 1},
                owner,
                204,
            )
    print("PASS project-owned copies: independent write, serving and collection")
