/** Catalogue shapes used only by a route-scoped standalone shell bootstrap. */

import type {
  CatalogueComponent,
  CatalogueComponentVariant,
  CataloguePage,
  CatalogueDocument,
  CatalogueReadModel,
  CatalogueScreen,
  CatalogueUsage,
  CatalogueUseCase,
  CatalogueView,
} from "./types.js";

/** Public usage plus the absence marker permitted only in shell bootstraps. */
export type ShellCatalogueUsage =
  CatalogueUsage | { readonly status: "omitted" };

/** One public view whose usage may be outside the current entry's scope. */
export interface ShellCatalogueView extends Omit<CatalogueView, "usage"> {
  usage: ShellCatalogueUsage;
}

/** A screen retained in the shell index with entry-scoped view usage. */
export interface ShellCatalogueScreen extends Omit<CatalogueScreen, "views"> {
  views: readonly ShellCatalogueView[];
}

/** A component variant retained with entry-scoped view usage. */
export interface ShellCatalogueVariant extends Omit<
  CatalogueComponentVariant,
  "views"
> {
  views: readonly ShellCatalogueView[];
}

/** Component parents own schema while their variant entries own views. */
export type ShellCatalogueComponent = CatalogueComponent;

/** Any current or historical entry retained by a scoped shell catalogue. */
export type ShellCatalogueRoutedEntry =
  | ShellCatalogueScreen
  | CataloguePage
  | CatalogueDocument
  | CatalogueUseCase
  | ShellCatalogueComponent
  | ShellCatalogueVariant;

/** Complete public index data with usage projected to one shell entry. */
export interface ShellCatalogueReadModel extends Omit<
  CatalogueReadModel,
  "screens" | "components" | "removedEntries"
> {
  screens: readonly ShellCatalogueScreen[];
  components: readonly (ShellCatalogueComponent | ShellCatalogueVariant)[];
  removedEntries: readonly {
    entry: ShellCatalogueRoutedEntry;
    folderTitles: readonly string[];
    snapshotId?: string;
    preview?: CatalogueReadModel["removedEntries"][number]["preview"];
  }[];
}
