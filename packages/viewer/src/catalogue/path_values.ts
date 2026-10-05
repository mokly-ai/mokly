/** Typed path values at validated storage and accepted-input boundaries. */

import type { BranchPointPath, CurrentPath } from "./path_types.js";
import { entryPath } from "./values.js";

/** Validate a stored current address before assigning its side. */
export function readCurrentPath(value: unknown): CurrentPath {
  return entryPath(value) as CurrentPath;
}

/** Validate a stored branch-point reference before assigning its side. */
export function readBranchPointPath(value: unknown): BranchPointPath {
  return entryPath(value) as BranchPointPath;
}
