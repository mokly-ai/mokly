import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "@mokly/viewer";

import type { EntryMove } from "./moves/types.js";

export interface ComponentVariantPair {
  before: ManifestComponentVariant | undefined;
  after: ManifestComponentVariant | undefined;
}

/** Group each variant under its current parent, then retain unpaired historical children. */
export function groupedVariantPairs(
  before: ManifestComponent | undefined,
  after: ManifestComponent | undefined,
  baseEntries: ReadonlyMap<string, ManifestComponentVariant>,
  headEntries: ReadonlyMap<string, ManifestComponentVariant>,
  moves: readonly EntryMove[],
): ComponentVariantPair[] {
  const previous = new Map(
    moves
      .filter((move) => move.kind === "component")
      .map((move) => [
        move.path.toLowerCase(),
        move.previousPath.toLowerCase(),
      ]),
  );
  const movedBases = new Set(previous.values());
  const heads = after
    ? [...headEntries.values()].filter(
        (entry) => entry.variantOf === after.path,
      )
    : [];
  const bases = before
    ? [...baseEntries.values()].filter(
        (entry) => entry.variantOf === before.path,
      )
    : [];
  return [
    ...heads.map((entry) => ({
      before: baseEntries.get(
        previous.get(entry.path.toLowerCase()) ?? entry.path.toLowerCase(),
      ),
      after: entry,
    })),
    ...bases
      .filter(
        (entry) =>
          !movedBases.has(entry.path.toLowerCase()) &&
          !headEntries.has(entry.path.toLowerCase()),
      )
      .map((entry) => ({ before: entry, after: undefined })),
  ];
}
