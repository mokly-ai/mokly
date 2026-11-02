import type {
  ShellCatalogueComponent,
  ShellCatalogueVariant,
} from "./scoped_types.js";

/** Whether a generated component record carries a parent identity. */
export function isComponentVariant(
  entry: ShellCatalogueComponent,
): entry is ShellCatalogueVariant {
  return entry.variantOf !== undefined;
}
