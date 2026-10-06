/** The home page's count of the catalogue's current entries. */

import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import type { ManifestEntry } from "../registry/types.js";

type EntryKind = ManifestEntry<
  CurrentPath,
  CurrentPath | BranchPointPath
>["kind"];

/**
 * Each entry kind's label, singular then plural, in the order the summary
 * lists them. A kind missing here fails to compile, so a new kind is counted.
 */
const LABELS = {
  screen: ["screen", "screens"],
  component: ["component", "components"],
  "use-case": ["user flow", "user flows"],
  page: ["catalogue page", "catalogue pages"],
  document: ["document", "documents"],
} as const satisfies Record<EntryKind, readonly [string, string]>;

/**
 * Count the current entries of every kind, variant records included, and
 * omit kinds with none. A catalogue with no entries has no summary.
 */
export function homeSummary(
  entries: readonly Pick<
    ManifestEntry<CurrentPath, CurrentPath | BranchPointPath>,
    "kind"
  >[],
): string | undefined {
  const counts = new Map<EntryKind, number>();
  for (const { kind } of entries) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  const parts = (Object.keys(LABELS) as EntryKind[]).flatMap((kind) => {
    const count = counts.get(kind) ?? 0;
    const [one, many] = LABELS[kind];
    return count === 0 ? [] : [`${count} ${count === 1 ? one : many}`];
  });
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
