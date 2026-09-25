/** Catalogue shapes used only by a route-scoped standalone shell bootstrap. */

import type {
  CatalogueComponent,
  CataloguePage,
  CatalogueReadModel,
  CatalogueScreen,
  CatalogueUsage,
  CatalogueUseCase,
  CatalogueVariant,
  CatalogueView,
} from "./types.js";

/** Public usage plus the absence marker permitted only in shell bootstraps. */
export type ShellCatalogueUsage =
  CatalogueUsage | { readonly status: "omitted" };

/** One public view whose usage may be outside the current route's scope. */
export interface ShellCatalogueView extends Omit<CatalogueView, "usage"> {
  usage: ShellCatalogueUsage;
}

/** A screen retained in the shell index with route-scoped view usage. */
export interface ShellCatalogueScreen extends Omit<CatalogueScreen, "views"> {
  views: readonly ShellCatalogueView[];
}

/** A saved component variant with route-scoped view usage. */
export interface ShellCatalogueVariant extends Omit<CatalogueVariant, "views"> {
  views: readonly ShellCatalogueView[];
}

/** A component retained in the shell index with route-scoped variant usage. */
export interface ShellCatalogueComponent extends Omit<
  CatalogueComponent,
  "variants"
> {
  variants: readonly ShellCatalogueVariant[];
}

/** Any current or historical entry retained by a scoped shell catalogue. */
export type ShellCatalogueRoutedEntry =
  | ShellCatalogueScreen
  | CataloguePage
  | CatalogueUseCase
  | ShellCatalogueComponent;

/** Complete public index data with usage projected to one shell route. */
export interface ShellCatalogueReadModel extends Omit<
  CatalogueReadModel,
  "screens" | "components" | "removedEntries"
> {
  screens: readonly ShellCatalogueScreen[];
  components: readonly ShellCatalogueComponent[];
  removedEntries: readonly {
    entry: ShellCatalogueRoutedEntry;
    ancestors: readonly { id: string; title: string }[];
    snapshotId?: string;
    preview?: CatalogueReadModel["removedEntries"][number]["preview"];
  }[];
}
