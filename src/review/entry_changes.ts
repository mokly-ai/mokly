import type { ChangedEntry, EntryChangeReason } from "@mokly/viewer/data";

import {
  address,
  entryPairKey,
  metadata,
  uniqueReasons,
  type entryPairs,
} from "./component_metadata.js";
import { previousPathFields } from "./moves/types.js";

/** One Changes record per kind and path, independent of grouped component presentation. */
export function pairedEntryChanges(
  changes: readonly ChangedEntry[],
  pairs: ReturnType<typeof entryPairs>,
  mapBefore: (path: string) => string = (path) => path,
  beforeDocuments: (source: string) => string = (source) => source,
  afterDocuments: (source: string) => string = (source) => source,
  mapSource: (source: string) => string = (source) => source,
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
    else if (
      metadata(before, mapBefore, beforeDocuments, mapSource) !==
      metadata(after, undefined, afterDocuments)
    )
      retained.push({ kind: "metadata" });
    const moved = previousPathFields(before, after);
    if (!retained.length && !moved.previousPath) return [];
    return [
      {
        kind: selected.kind,
        ...moved,
        ...(before ? { before: address(before) } : {}),
        ...(after ? { after: address(after) } : {}),
        reasons: uniqueReasons(retained),
      },
    ];
  });
}
