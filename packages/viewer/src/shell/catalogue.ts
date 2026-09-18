import type { CatalogueReadModel } from "../catalogue/types.js";
import type { ManifestComponent } from "../components/manifest_types.js";
import {
  analyzeHierarchy,
  type CatalogueHierarchy,
} from "../registry/hierarchy.js";
import type { ManifestEntry, ManifestScreen } from "../registry/types.js";

import type { CatalogueMetadata } from "./metadata.js";
import { type RemovedEntrySnapshot } from "./metadata.js";

/** Validated lookup model used by server routes. */
export interface Catalogue {
  publicModel?: CatalogueReadModel;
  byId: ReadonlyMap<string, ManifestEntry>;
  byRoute: ReadonlyMap<string, ManifestEntry>;
  /** Whether any screen in the catalogue was rendered in the dark scheme. */
  hasDarkFragments: boolean;
  hierarchy: CatalogueHierarchy<ManifestEntry>;
  manifest: CatalogueMetadata;
  /** Every classification tag the entries declare, deduplicated and sorted. */
  tags: readonly string[];
  /** Baseline screens retained only for on-demand comparisons. */
  removedScreens: readonly ManifestScreen[];
  removedEntries: readonly RemovedEntrySnapshot[];
  /** Removed component variants retain their immutable baseline for inspection. */
  removedComponents: readonly ManifestComponent[];
}

/** The union of the tags declared across every entry that can carry them. */
function collectTags(entries: readonly ManifestEntry[]): readonly string[] {
  const declared: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== "collection") declared.push(...(entry.tags ?? []));
  }
  return [...new Set(declared)].sort();
}

/** Build deterministic id and route indexes from a validated manifest. */
export function createCatalogue(
  manifest: CatalogueMetadata,
  removedEntries: readonly RemovedEntrySnapshot[] = [],
): Catalogue {
  const removedScreens = removedEntries.flatMap(({ entry }) =>
    entry.kind === "screen" ? [entry] : [],
  );
  const removedComponents = removedEntries.flatMap(({ entry }) =>
    entry.kind === "component" ? [entry] : [],
  );
  const byId = new Map(manifest.entries.map((entry) => [entry.id, entry]));
  const byRoute = new Map<string, ManifestEntry>();
  for (const entry of manifest.entries) {
    if (entry.kind !== "collection") byRoute.set(entry.route, entry);
  }
  for (const { entry } of removedEntries)
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  const hasDarkFragments = [
    ...manifest.entries,
    ...removedScreens,
    ...removedComponents,
  ].some((entry) =>
    entry.kind === "screen"
      ? entry.darkFragments !== undefined
      : entry.kind === "component" &&
        entry.variants.some((variant) => variant.darkFragments !== undefined),
  );
  const hierarchy = analyzeHierarchy<ManifestEntry>(manifest.entries).hierarchy;
  const tags = collectTags(manifest.entries);
  return {
    byId,
    byRoute,
    hasDarkFragments,
    hierarchy,
    manifest,
    tags,
    removedScreens,
    removedComponents,
    removedEntries,
  };
}
