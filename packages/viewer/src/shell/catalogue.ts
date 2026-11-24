import { currentCatalogueEntries } from "../catalogue/entry_selection.js";
import { keepEqualJson } from "../catalogue/json_values.js";
import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellRemovedEntry,
} from "../catalogue/scoped_types.js";
import { catalogueHierarchy } from "../registry/catalogue_hierarchy.js";
import type { CatalogueHierarchy } from "../registry/hierarchy.js";

/** Index-derived navigation and identities, with separately held detail data. */
export interface Catalogue {
  publicModel: ShellCatalogueReadModel;
  entries: readonly ShellCatalogueRoutedEntry[];
  byPath: ReadonlyMap<string, ShellCatalogueRoutedEntry>;
  /** Whether any current or retained view was rendered in the dark scheme. */
  hasDarkFragments: boolean;
  hierarchy: CatalogueHierarchy<ShellCatalogueRoutedEntry>;
  /** Every current classification tag, deduplicated and sorted. */
  tags: readonly string[];
  removedEntries: readonly ShellRemovedEntry[];
  /** Accepted move pairs. Shell consumers read them only through `branchPoints`. */
  previousPaths: ReadonlyMap<string, string>;
}

/** Index the records and tree, reusing lookups that already hold those records. */
export function createCatalogue(
  model: ShellCatalogueReadModel,
  previous?: Catalogue,
): Catalogue {
  const entries = currentCatalogueEntries<ShellCatalogueRoutedEntry>(model);
  if (
    previous &&
    model.tree === previous.publicModel.tree &&
    model.treeOrder === previous.publicModel.treeOrder &&
    sameRecords(previous.entries, entries) &&
    sameRecords(previous.removedEntries, model.removedEntries)
  )
    return { ...previous, publicModel: model };
  const byPath = new Map<string, ShellCatalogueRoutedEntry>(
    entries.map((entry) => [entry.path, entry]),
  );
  for (const { entry } of model.removedEntries) byPath.set(entry.path, entry);
  const tags = [...new Set(entries.flatMap((entry) => entry.tags))].sort();
  return {
    publicModel: model,
    entries,
    byPath,
    hasDarkFragments: [...byPath.values()].some(
      (entry) =>
        (entry.kind === "screen" ||
          entry.kind === "document" ||
          entry.kind === "component") &&
        entry.colorSchemes.includes("dark"),
    ),
    hierarchy: catalogueHierarchy(entries, model.tree, model.treeOrder),
    tags: previous ? keepEqualJson(previous.tags, tags) : tags,
    removedEntries: model.removedEntries,
    previousPaths: new Map(
      entries.flatMap(({ path, previousPath }) =>
        previousPath === undefined ? [] : [[path, previousPath]],
      ),
    ),
  };
}

function sameRecords<T>(held: readonly T[], next: readonly T[]): boolean {
  return (
    held.length === next.length &&
    next.every((item, index) => item === held[index])
  );
}
