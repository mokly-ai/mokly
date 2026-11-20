// The shared publication fixture is repacked rather than regenerated: the bytes
// are the pinned contract artifact, and only the envelope naming the branch,
// head and pull request changes, which is exactly what a second publication of
// the same work differs by. The ownership marker is rebuilt to declare the new
// envelope, as `mokly publish` does, and the script answers with the Plan
// archive of envelope, marker and index, plus every file's bytes by digest for
// the blob requests. A current-only upload disables the index's Changes the
// way `scripts/cloud/publication_exchange.py` does.
export const repack = `
import base64, hashlib, io, json, sys, tarfile
source, branch, head, pull, corrupt, current, detail_version, repository, helpers = sys.argv[1:10]
sys.path.insert(0, helpers)
from publication_exchange import current_only_files
with tarfile.open(source, mode="r:gz") as archive:
    files = {item.name: archive.extractfile(item).read()
             for item in archive if item.isfile()}
marker = ".mokly-export-artifact"
envelope_path = "mokly-upload.json"
index_path = "mokly-viewer/index.json"
envelope = json.loads(files[envelope_path])
owner, name = repository.split("/")
envelope["repository"] = {"host": "github.com", "owner": owner, "name": name}
envelope["branch"] = branch
envelope["headSha"] = head
envelope["pullRequest"] = int(pull) if pull else None
if current == "yes":
    files = current_only_files(files)
    envelope.update(baseRef=None, baseSha=None)
if detail_version:
    for path in [path for path in files if path.startswith("mokly-viewer/entries/")]:
        detail = json.loads(files[path])
        detail["schemaVersion"] = int(detail_version)
        files[path] = json.dumps(detail).encode()
files[envelope_path] = json.dumps(envelope).encode()
digest = lambda data: hashlib.sha256(data).hexdigest()
files[marker] = json.dumps({"schemaVersion": 3, "files": [
    {"path": path, "sha256": digest(data), "size": len(data)}
    for path, data in sorted(files.items()) if path != marker]}).encode()
if corrupt == "yes":
    files[marker] = json.dumps({"schemaVersion": 3, "files": [
        {"path": "missing.html", "sha256": "0" * 64, "size": 1}]}).encode()
names = [envelope_path, marker, index_path]
buffer = io.BytesIO()
with tarfile.open(fileobj=buffer, mode="w:gz", format=tarfile.USTAR_FORMAT) as out:
    for name in names:
        info = tarfile.TarInfo(name)
        info.size = len(files[name])
        out.addfile(info, io.BytesIO(files[name]))
json.dump({"plan": base64.b64encode(buffer.getvalue()).decode(),
           "blobs": {digest(data): base64.b64encode(data).decode()
                     for data in files.values()}}, sys.stdout)
`;
