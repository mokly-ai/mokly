/**
 * The variant rules shared by the catalogue policies. This module stays free
 * of React so browser specs can import the inventories that use it.
 */

/** What the inventories read of one catalogue index record. */
export interface InventoryRecord {
  path: string;
  kind: string;
  variantOf?: string;
}

/** Most variants one screen carries: with its parent, five renders. */
export const screenVariantLimit = 4;

/** Most saved variants one component carries, beside its own page. */
export const componentVariantLimit = 5;

/**
 * The parent path of a screen or component variant: a loaded definition or a
 * catalogue index record.
 */
export function variantParent(entry: object): string | undefined {
  return "variantOf" in entry && typeof entry.variantOf === "string"
    ? entry.variantOf
    : undefined;
}
