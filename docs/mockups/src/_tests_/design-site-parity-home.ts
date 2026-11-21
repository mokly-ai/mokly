/**
 * The recorded parity differences of the home area.
 * `design-site-parity.test.ts` merges this list with the lists of the other
 * areas. Each key is a selector that the mockup sheets and the site sheets
 * both declare with different values; each value says why, and which
 * milestone of the Canvas redesign plan removes the difference.
 */

const FOUNDATION =
  "Canvas home: the open foundation wires its source to the rendered artboard and draws the steps as a flow of frames; Milestone 5 rebuilds the home";

export const HOME_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-closing": FOUNDATION,
  ".site-closing-copy h2": FOUNDATION,
};
