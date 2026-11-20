import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { scratchDirectory } from "../../../../../apps/_tests_/scratch.mjs";
import { fixture } from "../publish";
import { repositoryRoot } from "../root";

// The frozen fixture has no tags. Add one to its documented index, retaining
// every entry and detail, so the real package renders its tag picker. Rebuild
// the ownership marker from the resulting bytes, as an exported artifact does.
const addTag = `
import hashlib, io, json, sys, tarfile
source, destination = sys.argv[1:3]
with tarfile.open(source, mode="r:gz") as archive:
    files = {item.name: archive.extractfile(item).read()
             for item in archive if item.isfile()}
index_path = "mokly-viewer/index.json"
index = json.loads(files[index_path])
for entry in index["screens"]:
    if entry["path"] == "start":
        entry["tags"] = ["layout"]
files[index_path] = json.dumps(index).encode()
marker = ".mokly-export-artifact"
files[marker] = json.dumps({"schemaVersion": 3, "files": [
    {"path": path, "sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}
    for path, data in sorted(files.items()) if path != marker]}).encode()
with tarfile.open(destination, mode="w:gz", format=tarfile.USTAR_FORMAT) as archive:
    for name, data in sorted(files.items()):
        info = tarfile.TarInfo(name)
        info.size = len(data)
        archive.addfile(info, io.BytesIO(data))
`;

/** A valid published artifact with one tag, owned by this browser test alone. */
export function taggedLayoutFixture(): {
  path: string;
  dispose: () => void;
} {
  const root = scratchDirectory(
    join(repositoryRoot, ".context", "viewer-layout-"),
  );
  const path = join(root, "tagged.tar.gz");
  const dispose = () => rmSync(root, { recursive: true, force: true });
  try {
    // The real upload API and the mounted package validate this artifact.
    execFileSync("python3", ["-c", addTag, fixture, path], {
      encoding: "utf8",
    });
    return { path, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
