"""Index-backed screens, moved paths and admission-backed sharing."""

import copy
import json
from pathlib import Path
import urllib.parse

from publication_exchange import ENVELOPE, INDEX, current_only_files, plan, plan_archive, publish, reason, with_marker
from publication_smoke_support import files_from_tar


PATH_LIMIT = 1024
ROOT = Path(__file__).resolve().parents[2]


def publish_index(api, project, token, files, index, head, branch):
    changed = dict(files)
    envelope = json.loads(changed[ENVELOPE])
    envelope.update(headSha=head, branch=branch)
    changed[ENVELOPE] = json.dumps(envelope).encode()
    changed[INDEX] = json.dumps(index).encode()
    publication = publish(api, project, token["secret"], with_marker(changed))
    return "/v1/projects/" + project["id"] + "/publications/" + publication["id"]


def single_screen_files(files, index, source_path):
    """Match the tree and retained detail to the screen under test."""
    screen = index["screens"][0]
    index["tree"] = [{"kind": "entry", "path": screen["path"]}]
    index.pop("treeOrder", None)
    changed = {path: data for path, data in files.items() if not path.startswith("mokly-viewer/entries/")}
    detail_path = "mokly-viewer/entries/" + source_path + ".json"
    detail = json.loads(files[detail_path])
    detail["entry"]["path"] = screen["path"]
    changed[detail_path] = json.dumps(detail).encode()
    return changed


def index_screens(api, project, token, _files):
    files = files_from_tar((ROOT / "crates/mkc-mokly-contract/fixtures/moves-export.tar.gz").read_bytes())
    index = json.loads(files[INDEX])
    root = publish_index(api, project, token, files, index, "9" * 40, "viewer-index")
    result, _ = api.call("GET", root + "/screens")
    screens = result["items"]
    assert [(screen["path"], screen["title"]) for screen in screens] == [
        ("account/kept", "Kept screen"), ("move-after", "Moved screen"), ("reuse-after", "Reused move")]
    views = [{"viewport": viewport, "colorScheme": scheme}
             for viewport in ["desktop", "mobile"] for scheme in ["light", "dark"]]
    for screen in screens:
        assert screen["views"] == views
        for view in screen["views"]:
            query = urllib.parse.urlencode({"catalogueScreen": screen["path"], "viewport": view["viewport"],
                                            "scheme": view["colorScheme"]})
            api.call("GET", root + "/share?" + query)
    for path in ["removed", "Account/Gone", "move-before", "reused", "variant-target/saved", "a" * 2049]:
        api.call("GET", root + "/share?" + urllib.parse.urlencode({"catalogueScreen": path}), expected=400)
    publication = root.rsplit("/", 1)[1]
    for side, path in [("before", "Account/Kept"), ("after", "account/kept")]:
        prefix = index["comparisonUrl"] + "snapshots/" + side + "/mokly-generated/" + path + "/"
        assert api.sql(f"SELECT count(*) FROM publication_files WHERE publication_id='{publication}' AND path LIKE '{prefix}%'") == "4"
    print("PASS index screens: current identities, ordering, four views, excluded removed/component entries and original case evidence")
    moved_paths(api, project, token, files, index)
    identity_boundaries(api, project, token, files, index)


def moved_paths(api, project, token, files, index):
    comparison = copy.deepcopy(index)
    screen = next(row for row in comparison["screens"] if row["path"] == "move-after")
    previous = screen["previousPath"]
    for kind in ["components", "documents", "pages", "useCases", "removedEntries"]:
        comparison[kind] = []
    comparison["screens"] = [screen]
    selected = single_screen_files(files, comparison, screen["path"])
    root = publish_index(api, project, token, selected, comparison, "8" * 40, "viewer-move")
    published, _ = api.call("GET", root)
    assert published["changes"] == {"state": "available", "added": 0, "changed": 1, "removed": 0}
    listed, _ = api.call("GET", root + "/screens")
    assert [entry["path"] for entry in listed["items"]] == ["move-after"]
    assert all("id" not in entry for entry in listed["items"])
    publication = root.rsplit("/", 1)[1]
    assert api.sql(f"SELECT DISTINCT screen_path FROM publication_screen_views WHERE publication_id='{publication}'") == "move-after"
    shared, _ = api.call("GET", root + "/share?catalogueScreen=move-after")
    assert urllib.parse.parse_qs(urllib.parse.urlparse(shared["url"]).query)["catalogueScreen"] == ["move-after"]
    api.call("GET", root + "/share?" + urllib.parse.urlencode({"catalogueScreen": previous}), expected=400)
    for path in ["a//b", "AUX", "a/COM9", "Mokly-Generated/a", "a.b", "a b", "a%2fb"]:
        invalid, _ = api.call("GET", root + "/share?" + urllib.parse.urlencode({"catalogueScreen": path}), expected=400)
        assert invalid["error"]["reason"] == "validation-failed"
    print("PASS path sharing: one moved entry counts once, stores its current path and refuses previous or invalid paths")


def identity_boundaries(api, project, token, files, index):
    spec = json.loads((ROOT / "docs/api/openapi.json").read_text())
    parameters = spec["paths"]["/v1/projects/{projectId}/publications/{publicationId}/share"]["get"]["parameters"]
    parameter = next(item for item in parameters if item["name"] == "catalogueScreen")
    assert parameter["schema"]["$ref"] == "#/components/schemas/EntryPath"
    assert share_path_limit() == 2048
    comparison = copy.deepcopy(index)
    screen = copy.deepcopy(index["screens"][0])
    source_path = screen["path"]
    identity = "a" * PATH_LIMIT
    screen["path"] = identity
    for kind in ["components", "documents", "pages", "useCases", "removedEntries"]:
        comparison[kind] = []
    comparison["screens"] = [screen]
    selected = single_screen_files(files, comparison, source_path)
    root = publish_index(api, project, token, selected, comparison, "a1" * 20, "viewer-identity")
    listed, _ = api.call("GET", root + "/screens?limit=1")
    assert [row["path"] for row in listed["items"]] == [identity] and listed["nextCursor"] is None
    publication = root.rsplit("/", 1)[1]
    assert api.sql(f"SELECT count(DISTINCT screen_path) FROM publication_screen_views WHERE publication_id='{publication}'") == "1"
    query = urllib.parse.urlencode({"catalogueScreen": identity, "viewport": "mobile", "scheme": "light"})
    shared, _ = api.call("GET", root + "/share?" + query)
    assert urllib.parse.parse_qs(urllib.parse.urlparse(shared["url"]).query)["catalogueScreen"] == [identity]
    # The dedicated rejected-identity Rust regression owns refused comparison metadata.
    # Check the shared index path limit with an authorized current-only envelope here.
    oversized = current_only_files(files)
    current = json.loads(oversized[INDEX])
    current["screens"][0]["path"] = identity + "a"
    oversized[INDEX] = json.dumps(current).encode()
    assert reason(plan(api, project, token["secret"], plan_archive(with_marker(oversized)), 413)) == "upload-too-large"
    print("PASS screen identity: the 1024-byte index path lists and shares, and one extra byte is refused")


def share_path_limit():
    spec = json.loads((ROOT / "docs/api/openapi.json").read_text())
    return spec["components"]["schemas"]["EntryPath"]["maxLength"]
