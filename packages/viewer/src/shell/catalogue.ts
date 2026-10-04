import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
import type { CatalogueHierarchy } from "../registry/hierarchy.js";
import { analyzeHierarchy } from "../registry/hierarchy.js";
import type {
  HistoricalManifestEntry,
  HistoricalManifestScreen,
  ManifestEntry,
  ManifestScreen,
} from "../registry/types.js";

import type { CatalogueMetadata, RemovedEntrySnapshot } from "./metadata.js";

/** Validated lookup model used by server routes. */
export interface Catalogue {
  publicModel?: ShellCatalogueReadModel;
  byId: ReadonlyMap<string, CatalogueManifestEntry>;
  /** Whether any current or retained view was rendered in the dark scheme. */
  hasDarkFragments: boolean;
  hierarchy: CatalogueHierarchy<ManifestEntry>;
  manifest: CatalogueMetadata;
  /** Every classification tag the entries declare, deduplicated and sorted. */
  tags: readonly string[];
  /** Baseline screens retained only for on-demand comparisons. */
  removedScreens: readonly (ManifestScreen | HistoricalManifestScreen)[];
  removedEntries: readonly RemovedEntrySnapshot[];
  /** Removed component parents retained as schemas for historical variants. */
  removedComponents: readonly CatalogueManifestEntry[];
}

/** Current and historical-v7 entries share identity and display metadata. */
export type CatalogueManifestEntry = ManifestEntry | HistoricalManifestEntry;

/** Resolve an entry identity, giving current content precedence over history. */
export function catalogueRouteEntry(
  catalogue: Catalogue,
  id: string,
  kind?: ManifestEntry["kind"],
): CatalogueManifestEntry | undefined {
  const entry = catalogue.byId.get(id);
  return entry && (kind === undefined || entry.kind === kind)
    ? entry
    : undefined;
}

/** Resolve one public current or historical selection into its display entry. */
export function catalogueSelectionEntry(
  catalogue: Catalogue,
  entryId: string,
  snapshotId?: string,
): CatalogueManifestEntry | undefined {
  if (snapshotId !== undefined)
    return catalogue.removedEntries.find(
      (record) =>
        record.entry.id === entryId && record.snapshotId === snapshotId,
    )?.entry;
  return catalogue.byId.get(entryId);
}

/** Resolve a current or retained variant's eligible same-kind parent. */
export function catalogueVariantParent(
  catalogue: Catalogue,
  entry: CatalogueManifestEntry,
): CatalogueManifestEntry | undefined {
  const candidate = catalogueVariantParentEntry(catalogue, entry);
  return candidate?.kind === entry.kind &&
    (!("variantOf" in candidate) || candidate.variantOf === undefined)
    ? candidate
    : undefined;
}

/** Resolve the entry named as a variant's parent, even when it is ineligible. */
export function catalogueVariantParentEntry(
  catalogue: Catalogue,
  entry: CatalogueManifestEntry,
): CatalogueManifestEntry | undefined {
  if (
    (entry.kind !== "screen" && entry.kind !== "component") ||
    !("variantOf" in entry) ||
    entry.variantOf === undefined
  )
    return;
  return (
    catalogue.hierarchy.variantParentById.get(entry.id) ??
    catalogue.removedEntries.find(
      ({ entry: historical }) => historical.id === entry.variantOf,
    )?.entry ??
    catalogue.byId.get(entry.variantOf)
  );
}

/** The union of the tags declared across every entry that can carry them. */
function collectTags(entries: readonly ManifestEntry[]): readonly string[] {
  const declared: string[] = [];
  for (const entry of entries) {
    declared.push(...(entry.tags ?? []));
  }
  return [...new Set(declared)].sort();
}

/** Build a deterministic id index from a validated manifest. */
export function createCatalogue(
  manifest: CatalogueMetadata,
  removedEntries: readonly RemovedEntrySnapshot[] = [],
): Catalogue {
  const removedScreens = removedEntries.flatMap(({ entry }) =>
    entry.kind === "screen" ? [entry] : [],
  );
  const removedComponents = removedEntries.flatMap(({ entry }) =>
    entry.kind === "component" && !isManifestComponentVariant(entry)
      ? [entry]
      : [],
  );
  const byId = new Map<string, CatalogueManifestEntry>(
    manifest.entries.map((entry) => [entry.id, entry]),
  );
  for (const { entry } of removedEntries) byId.set(entry.id, entry);
  const hasDarkFragments = [
    ...manifest.entries,
    ...removedEntries.map(({ entry }) => entry),
  ].some(
    (entry) =>
      (entry.kind === "screen" ||
        (entry.kind === "component" && isManifestComponentVariant(entry))) &&
      entry.colorSchemes.includes("dark"),
  );
  const hierarchy = analyzeHierarchy<ManifestEntry>(manifest.entries).hierarchy;
  const tags = collectTags(manifest.entries);
  return {
    byId,
    hasDarkFragments,
    hierarchy,
    manifest,
    tags,
    removedScreens,
    removedComponents,
    removedEntries,
  };
}
