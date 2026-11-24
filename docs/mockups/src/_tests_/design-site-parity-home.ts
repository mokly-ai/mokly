/**
 * The recorded parity differences of the home area.
 * `design-site-parity.test.ts` merges these lists with the lists of the other
 * areas. Each key is a selector that the mockup sheets and the site sheets
 * both declare with different values. A value of `HOME_DIFFERENCES` says why
 * the rule differs, and which milestone of the Canvas redesign plan removes
 * the difference, or why the difference stays. A value of
 * `HOME_PROPERTY_DIFFERENCES` names the one property that differs and says
 * why; every other declaration of the rule must agree.
 */

/** A shared rule whose one property differs on purpose, and why. */
export interface PropertyDifference {
  readonly property: string;
  readonly reason: string;
}

export const HOME_DIFFERENCES: Readonly<Record<string, string>> = {};

export const HOME_PROPERTY_DIFFERENCES: Readonly<
  Record<string, PropertyDifference>
> = {
  ".site-root--zoomed-in .site-footer-inner": {
    property: "width",
    reason:
      "both keep the zoomed footer frame's width of 100%, but the drawings scale the frame with CSS zoom, because a static drawing runs no script to set a transformed part's height, and under CSS zoom the frame's percentages resolve against the footer's width divided by the zoom; the site scales the frame with a transform, which leaves its percentages as they are. The difference stays while the drawings are static",
  },
};
