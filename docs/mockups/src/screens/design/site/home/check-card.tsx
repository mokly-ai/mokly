/**
 * The GitHub check card of the Changes frame: acme/storefront's pull request
 * #482 with the Mokly check, which counts the changed screens and offers
 * View changes. A depiction of another product, so View changes is text.
 */

import { MoklyMark } from "../parts/brand.js";
import { SiteIcon } from "../parts/icons.js";

/** The pull request check that leads into the viewer. */
export function CheckCard() {
  return (
    <div aria-hidden="true" className="site-home-check">
      <div className="site-home-check-head">
        <SiteIcon className="site-home-check-github" name="github" size={17} />
        <b>acme/storefront</b>
        <span className="site-home-check-pr">
          <SiteIcon name="pullRequest" size={14} />
          #482
        </span>
        <span className="site-home-check-state">Open</span>
      </div>
      <p className="site-home-check-title">feat/checkout-v2 → main</p>
      <div className="site-home-check-row">
        <SiteIcon className="site-home-check-ok" name="checkCircle" size={17} />
        <span className="site-home-check-app">
          <MoklyMark size={22} />
        </span>
        <span className="site-home-check-text">
          <b>Mokly</b>
          <span>3 screens changed, 1 added</span>
        </span>
        <span className="site-home-check-link">
          View changes <span className="site-button-arrow">→</span>
        </span>
      </div>
    </div>
  );
}
