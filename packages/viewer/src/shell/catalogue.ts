import type { BeforePath } from "../catalogue/path_types.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
import {
  analyzeHierarchy,
  type CatalogueHierarchy,
} from "../registry/hierarchy.js";
import type { ManifestEntry, ManifestScreen } from "../registry/types.js";

import type { CatalogueMetadata } from "./metadata.js";
import { type RemovedEntrySnapshot } from "./metadata.js";

/** Validated lookup model used by server routes. */
export interface Catalogue<Path extends string = string> {
  publicModel?: ShellCatalogueReadModel;
  byPath: ReadonlyMap<Path, CatalogueManifestEntry<Path>>;
  /** Whether any current or retained view was rendered in the dark scheme. */
  hasDarkFragments: boolean;
  hierarchy: CatalogueHierarchy<ManifestEntry<Path>>;
  manifest: CatalogueMetadata<Path>;
  /** Every classification tag the entries declare, deduplicated and sorted. */
  tags: readonly string[];
  /** Baseline screens retained only for on-demand comparisons. */
  removedScreens: readonly ManifestScreen<Path, BeforePath<Path>>[];
  removedEntries: readonly RemovedEntrySnapshot<Path>[];
  /** Removed component parents retained as schemas for historical variants. */
  removedComponents: readonly CatalogueManifestEntry<Path>[];
  /**
   * The branch-point path of each current entry the move contract paired with
   * a baseline entry, keyed by the current path. Empty until Changes is ready.
   * Shell consumers read pairs only through `branchPoints`.
   */
  previousPaths: ReadonlyMap<Path, BeforePath<Path>>;
}

/** Current and historical-v7 entries share identity and display metadata. */
export type CatalogueManifestEntry<Path extends string = string> =
  ManifestEntry<Path, Path | BeforePath<Path>>;

/** Resolve an entry identity, giving current content precedence over history. */
export function catalogueRouteEntry(
  catalogue: Catalogue,
  id: string,
  kind?: ManifestEntry["kind"],
): CatalogueManifestEntry | undefined {
  const entry = catalogue.byPath.get(id);
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
        record.entry.path === entryId && record.snapshotId === snapshotId,
    )?.entry;
  return catalogue.byPath.get(entryId);
}

/** The union of the tags declared across every entry that can carry them. */
function collectTags(entries: readonly ManifestEntry[]): readonly string[] {
  const declared: string[] = [];
  for (const entry of entries) {
    declared.push(...(entry.tags ?? []));
  }
  return [...new Set(declared)].sort();
}

/**
 * Build a deterministic id index from a validated manifest, its retained
 * removed entries, and the current entries the move contract paired.
 */
export function createCatalogue(
  manifest: CatalogueMetadata,
  removedEntries: readonly RemovedEntrySnapshot[] = [],
  moves: readonly { path: string; previousPath: string }[] = [],
): Catalogue {
  const removedScreens = removedEntries.flatMap(({ entry }) =>
    entry.kind === "screen" ? [entry] : [],
  );
  const removedComponents = removedEntries.flatMap(({ entry }) =>
    entry.kind === "component" && !isManifestComponentVariant(entry)
      ? [entry]
      : [],
  );
  const byPath = new Map<string, CatalogueManifestEntry>(
    manifest.entries.map((entry) => [entry.path, entry]),
  );
  for (const { entry } of removedEntries) byPath.set(entry.path, entry);
  const hasDarkFragments = [
    ...manifest.entries,
    ...removedEntries.map(({ entry }) => entry),
  ].some(
    (entry) =>
      (entry.kind === "screen" ||
        entry.kind === "document" ||
        (entry.kind === "component" && isManifestComponentVariant(entry))) &&
      entry.colorSchemes.includes("dark"),
  );
  const hierarchy = analyzeHierarchy<ManifestEntry>(
    manifest.entries,
    manifest.folders,
  ).hierarchy;
  const tags = collectTags(manifest.entries);
  const current = new Set(manifest.entries.map((entry) => entry.path));
  const previousPaths = new Map(
    moves.flatMap(({ path, previousPath }) =>
      current.has(path) ? [[path, previousPath] as const] : [],
    ),
  );
  return {
    byPath,
    hasDarkFragments,
    hierarchy,
    manifest,
    tags,
    removedScreens,
    removedComponents,
    removedEntries,
    previousPaths,
  };
}
