/**
 * The pricing page: the plans of the open-source CLI and of Mokly Cloud. It
 * draws the chrome and the page heading.
 */

import { SiteLayout } from "./parts/chrome.js";
import { SITE_SCREENS } from "./parts/links.js";

/** The pricing screen, with its composition selected by the viewport. */
export function SitePricingScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return (
    <SiteLayout active={SITE_SCREENS.pricing} viewport={viewport}>
      <main className="site-document" id="main">
        <div className="site-document-intro">
          <h1>Free for open source. Team for private projects.</h1>
        </div>
      </main>
    </SiteLayout>
  );
}
