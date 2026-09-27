import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "@mokly/viewer";
import type {
  HistoricalManifest,
  ManifestPage,
  ManifestScreen,
} from "@mokly/viewer/data";
import { flattenComponentVariantEntries } from "@mokly/viewer/data";

import type { CatalogueMetadata } from "./catalogue_index.js";
import { orderEntriesWithVariants } from "./entry_order.js";

/** Baseline context retained independently of current folder placement. */
export interface RemovedEntrySnapshot {
  /** Complete baseline DTO, including `variantOf` when the screen was a variant. */
  entry:
    | ManifestPage
    | ManifestScreen
    | ManifestComponent
    | ManifestComponentVariant;
}

/** One pinned generation shared by Browse, watched updates and publication. */
export interface CatalogueChangeSnapshot {
  schemaVersion: 1;
  baseRef: string;
  baseCommit: string;
  changedRoutes: readonly string[];
  removedEntries: readonly RemovedEntrySnapshot[];
}

/** Retain supported baseline entries whose ids are absent from the current catalogue. */
export function removedManifestEntries(
  manifest: CatalogueMetadata,
  baseline: HistoricalManifest,
): RemovedEntrySnapshot[] {
  const ids = new Set(manifest.entries.map((entry) => entry.id));
  return orderEntriesWithVariants(
    flattenComponentVariantEntries(baseline.entries),
    (entry) => entry,
  ).flatMap((entry): RemovedEntrySnapshot[] =>
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
