/**
 * The recorded parity differences of the home area.
 * `design-site-parity.test.ts` merges this list with the lists of the other
 * areas. Each key is a selector that the mockup sheets and the site sheets
 * both declare with different values; each value says why, and which
 * milestone of the Canvas redesign plan removes the difference, or why the
 * difference stays.
 */

export const HOME_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-root--zoomed-in .site-footer-inner":
    "both keep the zoomed footer frame's width of 100%, but the drawings scale the frame with CSS zoom, because a static drawing runs no script to set a transformed part's height, and under CSS zoom the frame's percentages resolve against the footer's width divided by the zoom; the site scales the frame with a transform, which leaves its percentages as they are. The difference stays while the drawings are static",
};
