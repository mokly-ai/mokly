/**
 * The compare toolbar of the depicted Mokly viewer in the home's Browse
 * frame: the product's five compare modes, in the product's order, which
 * `docs/protocol/mokly-comparison-panes.md` defines, and the mode that the
 * depicted compare draws. `ViewerCompare.astro` draws them.
 */

/** The product's compare modes, in the product's order. */
export const COMPARE_MODES = [
  "Current",
  "Side by side",
  "Overlay",
  "Difference",
  "Swipe",
] as const;

/** One of the product's compare modes. */
export type CompareMode = (typeof COMPARE_MODES)[number];

/** The mode that the depicted compare draws: Swipe, with its divider. */
export const CHOSEN_MODE: CompareMode = "Swipe";
