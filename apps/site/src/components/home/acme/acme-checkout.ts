/**
 * The order of the depicted acme/storefront checkout: the lines above its
 * total, which `AcmeTotals.astro` draws. The phone checkout and the
 * redesigned desktop payment step show the subtotal and the shipping; the
 * plain step on `main` itemises each bag. The total is always $42.00.
 */

/** The lines above the total, each a label and an amount. */
export type AcmeTotalLines = ReadonlyArray<
  readonly [label: string, amount: string]
>;

/** The subtotal and the shipping of the order. */
export const ACME_SUBTOTAL: AcmeTotalLines = [
  ["Subtotal", "$40.00"],
  ["Shipping", "$2.00"],
];

/** The order on `main`, before the redesign: each bag, then the shipping. */
export const ACME_ITEMISED: AcmeTotalLines = [
  ["Guji, Ethiopia × 1", "$19.00"],
  ["Huila, Colombia × 1", "$21.00"],
  ["Shipping", "$2.00"],
];
