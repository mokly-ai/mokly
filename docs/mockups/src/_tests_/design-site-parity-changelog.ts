/**
 * The recorded parity differences of the changelog area: Version history,
 * the note filter and the release frames. `design-site-parity.test.ts`
 * merges this list with the lists of the other areas. Each key is a selector
 * that the mockup sheets and the site sheets both declare with different
 * values; each value says why the difference is structural.
 */

const MOBILE =
  "only the mockup's mobile composition declares this property; the site's base rule is the mobile composition, so the site's desktop composition keeps the property or sets it again, and draws what the mockup's desktop draws without a declaration";

const BELOW =
  "the mockup's step below 721px draws its desktop composition narrower than the site's 768px breakpoint; the site draws the mobile composition there and has no such step, so its desktop keeps the values of the wider frames";

const LANDING =
  "the site's root scroll padding clears the tool bar, 56px on desktop and 60px on mobile, so the site's scroll margin is the mockup's less the bar's height, and a jump lands the part where the mockup lands it";

const RESET =
  "the mockup's reset of the headings and paragraphs under its root outweighs this rule, so the mockup draws the reset's value; the site's reset weighs less, so the site leaves out the declaration and draws the same";

export const CHANGELOG_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-release-index":
    "the mobile mockup does not draw Version history, so the rule that places it applies to its mobile composition unseen; the site draws the panel on every page and hides it below 1200px. The panel sticks 72px below the window top, under the 56px tool bar, as the docs panels do, where the mockup writes 60px + 24px from the mobile bar's height",
  ".site-changelog-filter": MOBILE,
  ".site-changelog-filter-option": MOBILE,
  ".site-changelog-filter-option svg": MOBILE,
  ".site-release": LANDING,
  ".site-release-group": LANDING,
  ".site-release-group-title": RESET,
  ".site-release-group-hint": RESET,
  ".site-release-meta": BELOW,
  ".site-release-counts": BELOW,
  ".site-release-notes": BELOW,
  ".site-release-pin": BELOW,
  ".site-release-links": `${BELOW}; and ${MOBILE}`,
  ".site-release-group--breaking": `the mockup sets the callout's 214px rail in changelog-release.css after the narrower steps of changelog-notes.css, which outweigh it through the viewport attribute, and its mobile rule for every group gives the callout one column; the site sets the rail for the desktop with its steps after it, so a comparison in sheet order reads the steps' single column; and ${BELOW}`,
  ".site-release-upgrade-count": MOBILE,
  ".site-release--compact": MOBILE,
  ".site-release-more > .site-release-summary": MOBILE,
};
