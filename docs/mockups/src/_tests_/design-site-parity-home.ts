/**
 * The recorded parity differences of the home area.
 * `design-site-parity.test.ts` merges this list with the lists of the other
 * areas. Each key is a selector that the mockup sheets and the site sheets
 * both declare with different values; each value says why, and which
 * milestone of the Canvas redesign plan removes the difference.
 */

const HERO =
  "Canvas home: Design in code. is a selected text layer at 162px with the lead and both actions under it, on the canvas; Milestone 5 rebuilds the home";
const FOUNDATION =
  "Canvas home: the open foundation wires its source to the rendered artboard and draws the steps as a flow of frames; Milestone 5 rebuilds the home";

export const HOME_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-actions": HERO,
  ".site-hero": HERO,
  ".site-hero h1": HERO,
  ".site-closing": FOUNDATION,
  ".site-closing-copy h2": FOUNDATION,
};
