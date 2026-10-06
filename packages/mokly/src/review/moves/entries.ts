import type { ManifestEntry } from "@mokly/viewer/data";

import { moveIdentity, type EntryMove } from "./types.js";

/** Index already-paired baseline entries by their current kind/path comparison key. */
export function baselineEntryIndex(
  entries: readonly ManifestEntry[],
  moves: readonly EntryMove[],
): ReadonlyMap<string, ManifestEntry> {
  const current = new Map(
    moves.map((move) => [
      `${move.kind}:${move.previousPath.toLowerCase()}`,
      `${move.kind}:${move.path.toLowerCase()}`,
    ]),
  );
  return new Map(
    entries.map((entry) => {
      const key = moveIdentity(entry);
      return [current.get(key) ?? key, entry];
    }),
  );
}

/** Add pure moves to navigation membership without marking their material changed. */
export function includeMovedEntries(
  changed: readonly string[] | undefined,
  moves: readonly Pick<EntryMove, "path">[] | undefined,
): readonly string[] | undefined {
  return moves?.length
    ? [
        ...new Set([...(changed ?? []), ...moves.map((move) => move.path)]),
      ].sort()
    : changed;
}
