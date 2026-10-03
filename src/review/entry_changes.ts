import type { ChangedEntry, EntryChangeReason } from "@mokly/viewer/data";

import {
  address,
  entryPairKey,
  metadata,
  uniqueReasons,
  type entryPairs,
} from "./component_metadata.js";

/** One Changes record per kind and path, independent of grouped component presentation. */
export function pairedEntryChanges(
  changes: readonly ChangedEntry[],
  pairs: ReturnType<typeof entryPairs>,
): ChangedEntry[] {
  const reasonsByKey = new Map<string, EntryChangeReason[]>();
  for (const change of changes) {
    const preferred = (change.after ?? change.before)!;
    const key = `${change.kind}:${preferred.path.toLowerCase()}`;
    reasonsByKey.set(key, [
      ...(reasonsByKey.get(key) ?? []),
      ...change.reasons,
    ]);
  }
  return pairs.flatMap(({ before, after }): ChangedEntry[] => {
    const selected = (after ?? before)!;
    const reasons = reasonsByKey.get(entryPairKey(selected));
    if (!reasons) return [];
    const retained = reasons.filter(
      (reason) => reason.kind !== "added" && reason.kind !== "removed",
    );
    if (!before) retained.push({ kind: "added" });
    else if (!after) retained.push({ kind: "removed" });
    else if (metadata(before) !== metadata(after))
      retained.push({ kind: "metadata" });
    if (!retained.length) return [];
    return [
      {
        kind: selected.kind,
        ...(before ? { before: address(before) } : {}),
        ...(after ? { after: address(after) } : {}),
        reasons: uniqueReasons(retained),
      },
    ];
  });
}
