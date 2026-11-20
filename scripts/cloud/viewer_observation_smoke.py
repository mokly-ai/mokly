"""Check retained observations and sharing while the object store is absent."""

from pathlib import Path
import subprocess
import uuid


def retained_observations(api, prefix, publication):
    path = prefix + "/publications/" + publication["id"]
    expected, _ = api.call("GET", path)
    assert expected["changes"] == {"state": "available", "added": 0, "changed": 7, "removed": 0}
    rows, _ = api.call("GET", prefix + "/publications?limit=100")
    root = Path(api.blobs.name)
    hidden = root.with_name(root.name + "-unavailable")
    root.rename(hidden)
    try:
        actual, _ = api.call("GET", path)
        assert actual == expected
        history, _ = api.call("GET", prefix + "/publications?limit=100")
        assert history == rows
        api.call("GET", path + "/share?catalogueScreen=start&viewport=mobile&scheme=light")
    finally:
        hidden.rename(root)
    statement = f"UPDATE publications SET changes_changed=changes_changed+1 WHERE id='{publication['id']}'"
    reject_sql(api, statement, "immutable publication")
    statement = f"""INSERT INTO publications
        (id,project_id,branch,head_sha,config_path,exported_at,state,created_at,deadline)
        VALUES ('{uuid.uuid4()}', '{expected['projectId']}', 'missing-observation',
        repeat('c',40), 'mokly.config.json', now(), 'ready', now(), now()+interval '15 minutes')"""
    reject_sql(api, statement, "violates check constraint")
    print("PASS retained Changes: history, publication and sharing work without file storage; database enforces immutable complete observations")


def reject_sql(api, statement, expected):
    result = subprocess.run(["psql", api.database, "-X", "-v", "ON_ERROR_STOP=1", "-c", statement],
                            capture_output=True, text=True, timeout=10)
    assert result.returncode != 0 and expected in result.stderr, (result.returncode, result.stderr)
