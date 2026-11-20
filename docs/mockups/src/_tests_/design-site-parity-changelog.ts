/**
 * The recorded parity differences of the changelog area: the release index
 * and the releases. `design-site-parity.test.ts` merges this list with the
 * lists of the other areas. Each key is a selector that the mockup sheets and
 * the site sheets both declare with different values; each value says why.
 */
export const CHANGELOG_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-release-index":
    "the depicted index is a sticky rail beside the entries; the site lists the real releases above them",
};
