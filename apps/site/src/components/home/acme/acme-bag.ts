/**
 * The coffee of the depicted acme/storefront app: its four roasts, the
 * class that gives a roast's colour to the parts inside it, and where the
 * beans of the welcome art lie. `AcmeBag.astro`, `AcmeTile.astro` and
 * `AcmeBeans.astro` draw them.
 */

/** One of the four roasts that the shop sells. */
export type AcmeRoast = "decaf" | "guji" | "huila" | "nyeri";

/** The class that gives a roast's colour to the parts inside it. */
export function roastTone(roast: AcmeRoast): string {
  return `site-acme-tone--${roast}`;
}

/** One bean of the welcome art: its x and y, its scale and its turn. */
export type AcmeBean = readonly [
  x: number,
  y: number,
  scale: number,
  turn: number,
];

/** Where each bean of the welcome art lies, on the art's 390 × 420 grid. */
export const ACME_BEANS: readonly AcmeBean[] = [
  [70, 330, 1.5, 20],
  [104, 352, 1.2, -30],
  [300, 342, 1.45, 60],
  [330, 316, 1.1, 10],
  [268, 366, 1.05, -50],
  [52, 300, 1, 70],
];
