import type { ManifestComponent } from "@mokly/viewer";
import type {
  HistoricalManifest,
  ManifestPage,
  ManifestScreen,
} from "@mokly/viewer/data";

import type { CatalogueMetadata } from "./catalogue_index.js";

/** Baseline context retained independently of current folder placement. */
export interface RemovedEntrySnapshot {
  /** Complete baseline DTO, including `variantOf` when the screen was a variant. */
  entry: ManifestPage | ManifestScreen | ManifestComponent;
}

/** One pinned generation shared by Browse, watched updates and publication. */
export interface CatalogueChangeSnapshot {
  schemaVersion: 1;
  baseRef: string;
  baseCommit: string;
  changedRoutes: readonly string[];
  removedEntries: readonly RemovedEntrySnapshot[];
}

/** Only a free old route retains a baseline leaf; current ids and routes always win. */
export function removedManifestEntries(
  manifest: CatalogueMetadata,
  baseline: HistoricalManifest,
): RemovedEntrySnapshot[] {
  const routes = new Set(manifest.entries.map((entry) => entry.route));
  const ids = new Set(manifest.entries.map((entry) => entry.id));
  return baseline.entries
    .flatMap((entry): RemovedEntrySnapshot[] =>
      (entry.kind === "page" ||
        entry.kind === "screen" ||
        (entry.kind === "component" && !ids.has(entry.id))) &&
      !routes.has(entry.route)
        ? [
            {
              entry,
            },
          ]
        : [],
    )
    .sort(
      (a, b) =>
        a.entry.route.localeCompare(b.entry.route) ||
        a.entry.id.localeCompare(b.entry.id),
    );
}
