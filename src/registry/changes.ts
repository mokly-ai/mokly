import type {
  HistoricalManifest,
  HistoricalManifestEntry,
  ManifestV8,
} from "@mokly/viewer/data";

import type { CatalogueMetadata } from "./catalogue_index.js";
import { orderEntriesWithVariants } from "./entry_order.js";

/** Baseline context retained independently of current folder placement. */
export interface RemovedEntrySnapshot {
  /** Complete baseline DTO, including `variantOf` when the screen was a variant. */
  entry: Exclude<
    HistoricalManifestEntry | ManifestV8["entries"][number],
    { kind: "use-case" }
  >;
}

/** One pinned generation shared by Browse, watched updates and publication. */
export interface CatalogueChangeSnapshot {
  schemaVersion: 1;
  baseRef: string;
  baseCommit: string;
  changedIds: readonly string[];
  removedEntries: readonly RemovedEntrySnapshot[];
}

/** Retain supported baseline entries whose ids are absent from the current catalogue. */
export function removedManifestEntries(
  manifest: CatalogueMetadata,
  baseline: HistoricalManifest,
): RemovedEntrySnapshot[] {
  const ids = new Set(manifest.entries.map((entry) => entry.id));
  return orderEntriesWithVariants(baseline.entries, (entry) => entry).flatMap(
    (entry): RemovedEntrySnapshot[] =>
      (entry.kind === "page" ||
        entry.kind === "screen" ||
        entry.kind === "component") &&
      !ids.has(entry.id)
        ? [
            {
              entry,
            },
          ]
        : [],
  );
}
