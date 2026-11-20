/**
 * The recorded parity differences of the home area: the hero, the depicted
 * product, the feature frames and the closing. `design-site-parity.test.ts`
 * merges this list with the lists of the other areas. Each key is a selector
 * that the mockup sheets and the site sheets both declare with different
 * values; each value says why.
 */
export const HOME_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-detail--split":
    "the depicted module detail sets its own gap; the site inherits the detail gap below the breakpoint",
  ".site-filter":
    "the mockup styles the filter inside the depicted navigation column; the site only ever renders its detail variant",
  ".site-topbar-menu":
    "the depicted shell keeps the menu control; the site's miniature drops it because no real value backs it",
  ".site-tree":
    "the depicted shell keeps the navigation column below the breakpoint; the site's miniature drops it",
};
