import path from "node:path";

import { verifyReleaseRefs } from "./refs.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const ref = process.argv[2];
const viewerRef = process.argv[3];
if (!ref || !viewerRef || process.argv.length !== 4)
  throw new Error("usage: verify-ref.mjs <vX.Y.Z> <viewer-vX.Y.Z>");
const head = await verifyReleaseRefs(repositoryRoot, ref, viewerRef);
process.stdout.write(`Verified ${viewerRef} and ${ref} at ${head}.\n`);
