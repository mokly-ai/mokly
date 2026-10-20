/** The shell's working catalogue: the index v7 with usage from held details. */

import type {
  CatalogueComponent,
  EntryDetailV2,
  CatalogueDocument,
  CataloguePage,
  CatalogueReadModel,
  CatalogueScreen,
  CatalogueUsage,
  CatalogueUseCase,
  CatalogueView,
  RemovedEntry,
  ViewEvidence,
} from "./types.js";

/** Detail usage, or `omitted` while the shell holds no detail for the entry. */
export type ShellCatalogueUsage =
  CatalogueUsage | { readonly status: "omitted" };

/** One index view with the usage and evidence its entry's detail carries. */
export interface ShellCatalogueView extends CatalogueView {
  usage: ShellCatalogueUsage;
  resourceEvidence?: ViewEvidence;
}

/** A screen whose views carry detail usage. */
export interface ShellCatalogueScreen extends Omit<CatalogueScreen, "views"> {
  views: readonly ShellCatalogueView[];
}

/** A component parent or variant whose views carry detail usage. */
export interface ShellCatalogueComponent extends Omit<
  CatalogueComponent,
  "views"
> {
  views: readonly ShellCatalogueView[];
}

/** A component variant whose views carry detail usage. */
export type ShellCatalogueVariant = ShellCatalogueComponent & {
  variantOf: string;
};

/** A page with the resource evidence its detail carries. */
export interface ShellCataloguePage extends CataloguePage {
  resourceEvidence?: ViewEvidence;
}

/** Any current or historical entry of the working catalogue. */
export type ShellCatalogueRoutedEntry =
  | ShellCatalogueScreen
  | ShellCataloguePage
  | CatalogueDocument
  | CatalogueUseCase
  | ShellCatalogueComponent;

/** One removed record of the working catalogue. */
export interface ShellRemovedEntry extends Omit<RemovedEntry, "entry"> {
  entry: ShellCatalogueRoutedEntry;
}

/** The complete index with the usage and evidence of every held detail. */
export interface ShellCatalogueReadModel extends Omit<
  CatalogueReadModel,
  "screens" | "pages" | "components" | "removedEntries"
> {
  screens: readonly ShellCatalogueScreen[];
  pages: readonly ShellCataloguePage[];
  components: readonly ShellCatalogueComponent[];
  removedEntries: readonly ShellRemovedEntry[];
  /** The accepted details by `detailKey`, each fenced against this index. */
  details: ReadonlyMap<string, EntryDetailV2>;
}
