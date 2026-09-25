import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
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
  publicModel?: ShellCatalogueReadModel;
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

/** Resolve a routed entry, giving current content precedence over history. */
export function catalogueRouteEntry(
  catalogue: Catalogue,
  route: string,
): ManifestEntry | undefined {
  return (
    catalogue.byRoute.get(route) ??
    catalogue.removedEntries.find(({ entry }) => entry.route === route)?.entry
  );
}

/** Resolve one public current or historical selection into its display entry. */
export function catalogueSelectionEntry(
  catalogue: Catalogue,
  entryId: string,
  snapshotId?: string,
): ManifestEntry | undefined {
  if (snapshotId !== undefined)
    return catalogue.removedEntries.find(
      (record) =>
        record.entry.id === entryId && record.snapshotId === snapshotId,
    )?.entry;
  if (!catalogue.publicModel) return catalogue.byId.get(entryId);
  const selected = resolveCatalogueSelection(
    catalogue.publicModel,
    entryId,
    snapshotId,
  );
  return selected
    ? catalogueRouteEntry(catalogue, selected.entry.route)
    : undefined;
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
