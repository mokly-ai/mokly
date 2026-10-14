import path from "node:path";

import { verifyReleaseRefs } from "./refs.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const viewerRef = process.argv[2];
if (!viewerRef || process.argv.length !== 3)
  throw new Error("usage: verify-ref.mjs {viewer-vX.Y.Z}");
const head = await verifyReleaseRefs(repositoryRoot, viewerRef);
process.stdout.write(`Verified ${viewerRef} at ${head}.\n`);
