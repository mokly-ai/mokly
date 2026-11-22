/**
 * The recorded parity differences of the pricing area: the plans, the plan
 * frames and the compare table. `design-site-parity.test.ts` merges this
 * list with the lists of the other areas. Each key is a selector that the
 * mockup sheets and the site sheets both declare with different values; each
 * value says why. The differences are structural, so no milestone removes
 * them: the site's width queries cannot keep a property in the mobile
 * composition alone, as the mockups' viewport attribute does.
 */

const MOBILE =
  "only the mockup's mobile composition declares this property; the site's base rule is the mobile composition, so the site's desktop rule sets the property again, to the value that the mockup's desktop draws without a declaration";

export const PRICING_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-pricing-plans .site-section-box": MOBILE,
  ".site-pricing-plan": MOBILE,
  ".site-pricing-plan-action .site-button": MOBILE,
  ".site-pricing-props-frame": MOBILE,
  ".site-pricing-props": MOBILE,
  ".site-pricing-props th": MOBILE,
  ".site-pricing-props td": MOBILE,
  ".site-pricing-props thead small": MOBILE,
  ".site-pricing-props-group th": MOBILE,
  '.site-pricing-props th[scope="row"]': MOBILE,
};
