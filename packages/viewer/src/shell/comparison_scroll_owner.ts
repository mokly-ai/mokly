/** Which version of an open comparison the reader scrolled last. */

/** One version of a comparison: Before or Current. */
export type ComparisonSide = "after" | "before";

/** The last-scrolled version, shared by every section of a comparison. */
export interface ScrollOwner {
  /** A reader action or a scroll the viewer did not make, in one version. */
  claim(side: ComparisonSide): void;
  /** The version turning Scroll together on aligns the others with. */
  side(): ComparisonSide;
}

/**
 * Track the last-scrolled version from Current, so turning Scroll together on
 * before any scroll is deterministic; a section without Current falls back to
 * the version it shows.
 */
export function createScrollOwner(): ScrollOwner {
  let last: ComparisonSide = "after";
  return {
    claim(side) {
      last = side;
    },
    side: () => last,
  };
}
