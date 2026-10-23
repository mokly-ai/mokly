import path from "node:path";

import { verifyReleaseRefs } from "./refs.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const [cliRef, second, third, fourth] = process.argv.slice(2);
const viewerRef =
  !second || second.startsWith("--") ? `viewer-${cliRef}` : second;
const flag = !second || second.startsWith("--") ? second : third;
const artifacts = !second || second.startsWith("--") ? third : fourth;
if (
  !cliRef ||
  ![3, 4, 5].includes(process.argv.length) ||
  (flag && (flag !== "--artifacts" || !artifacts))
)
  throw new Error("usage: verify-ref.mjs {vX.Y.Z} [--artifacts {directory}]");
const head = await verifyReleaseRefs(root, cliRef, viewerRef);
if (artifacts) {
  const { inspectReleaseSet } = await import("./package_set.mjs");
  await inspectReleaseSet(root, artifacts);
}
process.stdout.write(
  `Verified shared tags ${cliRef} and ${viewerRef} at ${head}.\n`,
);
