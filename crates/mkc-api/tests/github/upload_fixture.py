"""Adapt the released envelope and index for real upload integration tests."""

import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile

ENVELOPE = "mokly-upload.json"
MARKER = ".mokly-export-artifact"
INDEX = "mokly-viewer/index.json"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def archive(files):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w", format=tarfile.USTAR_FORMAT) as tar:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            info.mode = 0o644
            tar.addfile(info, io.BytesIO(data))
    return gzip.compress(output.getvalue(), mtime=0)


root = Path(__file__).resolve().parents[4]
with tarfile.open(root / "crates/mkc-mokly-contract/fixtures/dogfood.tar.gz", "r:gz") as tar:
    files = {entry.name: tar.extractfile(entry).read() for entry in tar if entry.isfile()}
envelope = json.loads(files[ENVELOPE])
parts = sys.argv[1].split("/")
if len(parts) == 2:
    host, owner, name = "github.com", parts[0], parts[1]
else:
    host, owner, name = parts[0], "/".join(parts[1:-1]), parts[-1]
envelope["repository"] = {"host": host, "owner": owner, "name": name}
envelope["headSha"] = sys.argv[2]
patch = json.loads(sys.argv[6]) if len(sys.argv) > 6 else {}
marker_version = patch.pop("markerVersion", 3)
if len(sys.argv) > 4:
    envelope.update(branch=sys.argv[3], configPath=sys.argv[4],
                    pullRequest=int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "null" else None,
                    baseRef=None, baseSha=None)
    index = json.loads(files[INDEX])
    index.pop("baseCommit", None)
    index.update(comparisonUrl=None, changesStatus="disabled", removedEntries=[])
    for kind in ["components", "documents", "pages", "screens", "useCases"]:
        for record in index[kind]:
            record["changes"] = {"status": "disabled"}
            record.pop("previousPath", None)
            if "comparison" in record:
                record["comparison"] = {"status": "disabled"}
            for view in record.get("views", []):
                view["comparison"] = {"status": "disabled"}
    files = {path: data for path, data in files.items() if not path.startswith("mokly-viewer/diffs/")}
    for path, data in list(files.items()):
        if not path.startswith("mokly-viewer/entries/") or not path.endswith(".json"):
            continue
        detail = json.loads(data)
        for key in ["reasons", "before", "resourceEvidence", "workspace"]:
            detail.pop(key, None)
        for view in detail["views"]:
            for key in ["state", "ignoredIds", "resourceEvidence"]:
                view.pop(key, None)
        files[path] = json.dumps(detail).encode()
    files[INDEX] = json.dumps(index).encode()
envelope.update(patch)
files[ENVELOPE] = json.dumps(envelope).encode()
declarations = [{"path": path, "sha256": digest(data), "size": len(data)}
                for path, data in sorted(files.items()) if path != MARKER]
files[MARKER] = json.dumps({"schemaVersion": marker_version, "files": declarations}).encode()
plan = archive({name: files[name] for name in [ENVELOPE, MARKER, INDEX]})
print(json.dumps({"plan": list(plan), "blobs": {digest(data): list(data) for data in files.values()}}))
