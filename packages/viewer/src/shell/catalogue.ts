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

/** Build navigation once from the validated generated records and index tree. */
export function createCatalogue(model: ShellCatalogueReadModel): Catalogue {
  const entries = [
    ...model.screens,
    ...model.pages,
    ...model.documents,
    ...model.useCases,
    ...model.components,
  ];
  const byPath = new Map<string, ShellCatalogueRoutedEntry>(
    entries.map((entry) => [entry.path, entry]),
  );
  for (const { entry } of model.removedEntries) byPath.set(entry.path, entry);
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
    tags: [...new Set(entries.flatMap((entry) => entry.tags))].sort(),
    removedEntries: model.removedEntries,
    previousPaths: new Map(
      entries.flatMap(({ path, previousPath }) =>
        previousPath === undefined ? [] : [[path, previousPath]],
      ),
    ),
  };
}
