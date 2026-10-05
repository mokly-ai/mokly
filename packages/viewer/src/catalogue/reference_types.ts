/** Unbranded records used while validating stored catalogue relationships. */

import type {
  ShellCatalogueComponent,
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueVariant,
  ShellCatalogueView,
} from "./scoped_types.js";
import type {
  CatalogueComponent,
  CatalogueComponentVariant,
  CatalogueReadModel,
  CatalogueRecord,
  CatalogueView,
} from "./types.js";

export type ValidatedCatalogue =
  CatalogueReadModel<string, string> | ShellCatalogueReadModel<string, string>;
export type ValidatedRoutedEntry =
  CatalogueRecord<string> | ShellCatalogueRoutedEntry<string>;
export type ValidatedComponent =
  CatalogueComponent<string> | ShellCatalogueComponent<string>;
export type ValidatedVariant =
  CatalogueComponentVariant<string> | ShellCatalogueVariant<string>;
export type ValidatedView = CatalogueView<string> | ShellCatalogueView<string>;
