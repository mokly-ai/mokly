/**
 * The pricing page, one more file in the design tool. The hero stands on
 * the plan grid, with a redline that measures the space under the heading.
 * The plans are frames in two section boxes, Mokly CLI and Mokly Cloud,
 * with Team selected. The comparison is a component's props table, and the
 * questions are resolved comment threads.
 */

import { SiteLayout } from "./parts/chrome.js";
import { SiteKicker } from "./parts/labels.js";
import { SITE_SCREENS } from "./parts/links.js";
import { PricingCompare } from "./parts/pricing-compare.js";
import { PricingPlans } from "./parts/pricing-plans.js";
import { PricingQuestions } from "./parts/pricing-questions.js";
import { SiteRedline } from "./parts/selection.js";

type Viewport = "mobile" | "desktop";

/**
 * The space under the heading, which the redline measures: to the plan
 * boxes on desktop, and to the lead when the hero stacks on mobile.
 */
const HEADING_SPACE: Record<Viewport, string> = { desktop: "64", mobile: "44" };

/** The hero: the kicker, the two-tone heading and the lead. */
function PricingHero({ viewport }: { viewport: Viewport }) {
  return (
    <section aria-labelledby="pricing-title" className="site-pricing-hero">
      <SiteKicker>Pricing</SiteKicker>
      <div className="site-pricing-heading">
        <h1 className="site-pricing-title" id="pricing-title">
          Free for open source. <br />
          <span>Team for private&nbsp;projects.</span>
        </h1>
        <SiteRedline
          className="site-pricing-redline"
          value={HEADING_SPACE[viewport]}
        />
      </div>
      <p className="site-pricing-lead">
        The Mokly CLI is free and MIT licensed. Mokly Cloud is free for public
        projects. Team adds private projects to the same workspace, billed
        monthly for the people who use it.
      </p>
    </section>
  );
}

/** The pricing screen, with its composition selected by the viewport. */
export function SitePricingScreen({ viewport }: { viewport: Viewport }) {
  return (
    <SiteLayout active={SITE_SCREENS.pricing} viewport={viewport}>
      <main className="site-pricing" id="main">
        <PricingHero viewport={viewport} />
        <PricingPlans viewport={viewport} />
        <PricingCompare />
        <PricingQuestions />
      </main>
    </SiteLayout>
  );
}
