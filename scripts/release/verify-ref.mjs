import path from "node:path";

import { verifyReleaseRefs } from "./refs.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const viewerRef = process.argv[2];
const [flag, artifacts] = process.argv.slice(3);
if (
  !viewerRef ||
  ![3, 5].includes(process.argv.length) ||
  (flag && (flag !== "--artifacts" || !artifacts))
)
  throw new Error(
    "usage: verify-ref.mjs {viewer-vX.Y.Z} [--artifacts {directory}]",
  );
const head = await verifyReleaseRefs(repositoryRoot, viewerRef);
if (artifacts) {
  const { inspectViewerArchive } = await import("./viewer.mjs");
  await inspectViewerArchive(artifacts);
}
process.stdout.write(`Verified ${viewerRef} at ${head}.\n`);
