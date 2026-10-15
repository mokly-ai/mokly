import path from "node:path";

import { verifyReleaseRefs } from "./refs.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const [cliRef, viewerRef, flag, artifacts] = process.argv.slice(2);
if (
  !cliRef ||
  !viewerRef ||
  ![4, 6].includes(process.argv.length) ||
  (flag && (flag !== "--artifacts" || !artifacts))
)
  throw new Error(
    "usage: verify-ref.mjs {vX.Y.Z} {viewer-vX.Y.Z} [--artifacts {directory}]",
  );
const head = await verifyReleaseRefs(root, cliRef, viewerRef);
if (artifacts) {
  const { inspectReleaseSet } = await import("./package_set.mjs");
  await inspectReleaseSet(root, artifacts);
}
process.stdout.write(`Verified ${cliRef} and ${viewerRef} at ${head}.\n`);
