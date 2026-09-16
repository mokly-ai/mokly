import path from "node:path";

import { isInside, projectRealPath } from "./paths.js";

/** Package-owned historical builds never participate in consumer inputs or output. */
export const MOKLY_CACHE = ".mokly-cache";

/** Recognize cache paths, optionally resolving current filesystem aliases. */
export function isBaselineCachePath(
  candidate: string,
  repoRoot: string,
  resolveAliases = true,
): boolean {
  const root = path.join(repoRoot, MOKLY_CACHE);
  if (isInside(root, path.resolve(candidate))) return true;
  if (!resolveAliases) return false;
  try {
    return isInside(projectRealPath(root), projectRealPath(candidate));
  } catch {
    return false;
  }
}
