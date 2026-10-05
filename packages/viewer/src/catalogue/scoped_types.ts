/** Catalogue shapes used only by a route-scoped standalone shell bootstrap. */

import type { BranchPointPath, CurrentPath } from "./path_types.js";
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
export type ShellCatalogueUsage<Reference extends string = CurrentPath> =
  CatalogueUsage<Reference> | { readonly status: "omitted" };

/** One public view whose usage may be outside the current entry's scope. */
export interface ShellCatalogueView<
  Reference extends string = CurrentPath,
> extends Omit<CatalogueView<Reference>, "usage"> {
  usage: ShellCatalogueUsage<Reference>;
}

/** A screen retained in the shell index with entry-scoped view usage. */
export interface ShellCatalogueScreen<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends Omit<CatalogueScreen<Path, Reference>, "views"> {
  views: readonly ShellCatalogueView<Reference>[];
}

/** A component variant retained with entry-scoped view usage. */
export interface ShellCatalogueVariant<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends Omit<CatalogueComponentVariant<Path, Reference>, "views"> {
  views: readonly ShellCatalogueView<Reference>[];
}

/** Component parents own schema while their variant entries own views. */
export type ShellCatalogueComponent<Path extends string = CurrentPath> =
  CatalogueComponent<Path>;

/** Any current or historical entry retained by a scoped shell catalogue. */
export type ShellCatalogueRoutedEntry<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> =
  | ShellCatalogueScreen<Path, Reference>
  | CataloguePage<Path, Reference>
  | CatalogueDocument<Path, Reference>
  | CatalogueUseCase<Path, Reference>
  | ShellCatalogueComponent<Path>
  | ShellCatalogueVariant<Path, Reference>;

/** Complete public index data with usage projected to one shell entry. */
export interface ShellCatalogueReadModel<
  Path extends string = CurrentPath,
  Before extends string = BranchPointPath,
> extends Omit<
  CatalogueReadModel<Path, Before>,
  "screens" | "components" | "removedEntries"
> {
  screens: readonly ShellCatalogueScreen<Path>[];
  components: readonly (
    ShellCatalogueComponent<Path> | ShellCatalogueVariant<Path>
  )[];
  removedEntries: readonly {
    entry: ShellCatalogueRoutedEntry<Path, Before>;
    folderTitles: readonly string[];
    /** Required exactly when the removed entry is a variant. */
    parentTitle?: string;
    snapshotId?: string;
    preview?: CatalogueReadModel["removedEntries"][number]["preview"];
  }[];
}

/** A routed record whose reference side is selected by its containing record. */
export type AnyShellCatalogueEntry = ShellCatalogueRoutedEntry<
  CurrentPath,
  CurrentPath | BranchPointPath
>;
export type AnyShellCatalogueView = ShellCatalogueView<
  CurrentPath | BranchPointPath
>;
export type AnyShellCatalogueVariant = ShellCatalogueVariant<
  CurrentPath,
  CurrentPath | BranchPointPath
>;
export type AnyShellCatalogueScreen = ShellCatalogueScreen<
  CurrentPath,
  CurrentPath | BranchPointPath
>;
export type AnyShellCatalogueUsage = ShellCatalogueUsage<
  CurrentPath | BranchPointPath
>;
