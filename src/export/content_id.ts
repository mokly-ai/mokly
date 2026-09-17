import crypto from "node:crypto";

import type { ReviewArtifactContent } from "@mokly/viewer/data";

/** Stable path/content hashes without locale- or insertion-order dependence. */
export function contentIdentities(
  files: ReadonlyMap<string, ReviewArtifactContent>,
): readonly (readonly [string, string])[] {
  return [...files]
    .sort(comparePaths)
    .map(([name, bytes]) => [
      name,
      crypto.createHash("sha256").update(bytes).digest("hex"),
    ]);
}

/** Hash the comparison inventory independently from its containing deployment. */
export function comparisonContentId(
  files: ReadonlyMap<string, ReviewArtifactContent>,
): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(contentIdentities(files)))
    .digest("hex");
}

/** Include alias edges as well as every finalized deployment file. */
export function deploymentContentId(
  files: ReadonlyMap<string, ReviewArtifactContent>,
  aliases: ReadonlyMap<string, string>,
): string {
  const edges = [...aliases].sort(comparePaths);
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([contentIdentities(files), edges]))
    .digest("hex");
}

function comparePaths(
  [left]: readonly [string, unknown],
  [right]: readonly [string, unknown],
): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
