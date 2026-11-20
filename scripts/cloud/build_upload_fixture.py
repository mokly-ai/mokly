"""Adapt a released catalogue for a build's real upload exchange in tests."""

import json
from pathlib import Path
import sys

from publication_exchange import current_only_files, digest, plan_archive, with_marker
from publication_smoke_support import files_from_tar

root = Path(__file__).resolve().parents[2]
files = current_only_files(files_from_tar((root / "crates/mkc-mokly-contract/fixtures/dogfood.tar.gz").read_bytes()))
envelope = json.loads(files["mokly-upload.json"])
owner, name = sys.argv[1].split("/")
envelope.update(
    repository={"host": "github.com", "owner": owner, "name": name},
    headSha=sys.argv[2],
    branch=sys.argv[3],
    configPath=sys.argv[4],
    pullRequest=int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "null" else None,
    baseRef=None,
    baseSha=None,
)
patch = json.loads(sys.argv[6]) if len(sys.argv) > 6 else {}
marker_version = patch.pop("markerVersion", None)
envelope.update(patch)
files = {path: data for path, data in files.items() if not path.startswith("mokly-viewer/diffs/")}
files["mokly-upload.json"] = json.dumps(envelope).encode()
files = with_marker(files)
if marker_version is not None:
    marker = json.loads(files[".mokly-export-artifact"])
    marker["schemaVersion"] = marker_version
    files[".mokly-export-artifact"] = json.dumps(marker).encode()
print(json.dumps({"plan": list(plan_archive(files)), "blobs": {digest(data): list(data) for data in files.values()}}))
