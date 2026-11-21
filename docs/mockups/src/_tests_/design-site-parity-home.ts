/**
 * The recorded parity differences of the home area.
 * `design-site-parity.test.ts` merges this list with the lists of the other
 * areas. Each key is a selector that the mockup sheets and the site sheets
 * both declare with different values; each value says why, and which
 * milestone of the Canvas redesign plan removes the difference.
 */

export const HOME_DIFFERENCES: Readonly<Record<string, string>> = {};
