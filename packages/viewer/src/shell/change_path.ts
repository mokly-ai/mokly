/** Resolve a change's original side address to its catalogue record address. */

import type {
  EntryIdentity,
  EntryReference,
} from "../catalogue/branch_point_types.js";
import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import type { ChangedEntry } from "../review/component_types.js";

export function changePath(
  lookup: {
    resolve(
      reference: EntryReference,
    ): { readonly entry: EntryIdentity } | undefined;
  },
  change: ChangedEntry<CurrentPath, BranchPointPath>,
): CurrentPath | undefined {
  return (
    change.after?.path ??
    (change.before &&
      lookup.resolve({
        kind: change.kind,
        path: change.before.path,
        side: "before",
      })?.entry.path)
  );
}
