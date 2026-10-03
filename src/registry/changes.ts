import { analyzeHierarchy } from "@mokly/viewer/data";
import type {
  HistoricalManifest,
  HistoricalManifestEntry,
  ManifestV8,
} from "@mokly/viewer/data";

import type { EntryMove } from "../review/moves/types.js";

import type { CatalogueMetadata } from "./catalogue_index.js";
import { orderEntriesWithVariants } from "./entry_order.js";

/** Baseline context retained independently of current folder placement. */
export interface RemovedEntrySnapshot {
  folderTitles: readonly string[];
  /** Complete baseline DTO, including `variantOf` when the screen was a variant. */
  entry: Exclude<
    HistoricalManifestEntry | ManifestV8["entries"][number],
    { kind: "use-case" }
  >;
}

/** One pinned generation shared by Browse, watched updates and publication. */
export interface CatalogueChangeSnapshot {
  schemaVersion: 2;
  baseRef: string;
  baseCommit: string;
  changedEntries: readonly string[];
  movedEntries: readonly { path: string; previousPath: string }[];
  removedEntries: readonly RemovedEntrySnapshot[];
}

/** Retain supported baseline entries whose case-folded paths are absent from the current catalogue. */
export function removedManifestEntries(
  manifest: CatalogueMetadata,
  baseline: HistoricalManifest,
  moves: readonly EntryMove[] = [],
): RemovedEntrySnapshot[] {
  const hierarchy = analyzeHierarchy(
    baseline.entries,
    baseline.folders,
  ).hierarchy;
  const paths = new Set(
    manifest.entries.map((entry) => entry.path.toLowerCase()),
  );
  const paired = new Set(moves.map((move) => move.previousPath.toLowerCase()));
  return orderEntriesWithVariants(baseline.entries, (entry) => entry).flatMap(
    (entry): RemovedEntrySnapshot[] =>
      (entry.kind === "page" ||
        entry.kind === "document" ||
        entry.kind === "screen" ||
        entry.kind === "component") &&
      !paths.has(entry.path.toLowerCase()) &&
      !paired.has(entry.path.toLowerCase())
        ? [
            {
              entry,
              folderTitles: hierarchy.ancestorsByPath.get(entry.path) ?? [],
            },
          ]
        : [],
  );
}
