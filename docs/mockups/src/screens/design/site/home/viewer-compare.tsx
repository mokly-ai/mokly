/**
 * The open screen of the depicted Mokly viewer: the screen head with
 * `Payment`, its path and its Changed status, the compare toolbar with the
 * product's five modes and Swipe chosen, and the stage, where the Swipe
 * divider shows `main` on its left and `feat/checkout-v2` on its right.
 */

import { SiteIcon } from "../parts/icons.js";
import { SiteChip } from "../parts/labels.js";
import { SiteCursor } from "../parts/people.js";

import { AcmePaymentDesktop } from "./acme/acme-payment.js";

/** The compare modes of the product, in the product's order. */
const COMPARE_MODES = [
  "Current",
  "Side by side",
  "Overlay",
  "Difference",
  "Swipe",
] as const;

/** The mode that the depicted compare draws. */
const CHOSEN_MODE: (typeof COMPARE_MODES)[number] = "Swipe";

/** The screen head, the toolbar and the stage of the open screen. */
export function ViewerCompare() {
  return (
    <div className="site-shell-main">
      <div className="site-screen-head">
        <span className="site-screen-title-row">
          <span className="site-screen-title">Payment</span>
          <span className="site-idchip">checkout/payment</span>
          <SiteChip tone="changed">Changed</SiteChip>
        </span>
        <span className="site-home-modes">
          {COMPARE_MODES.map((mode) => (
            <span
              className={
                mode === CHOSEN_MODE
                  ? "site-home-mode site-home-mode--chosen"
                  : "site-home-mode"
              }
              key={mode}
            >
              {mode}
            </span>
          ))}
        </span>
      </div>
      <div className="site-stage">
        <div className="site-stage-frame">
          <div className="site-stage-screen">
            <AcmePaymentDesktop version="main" />
          </div>
          <div className="site-stage-screen site-home-swipe-branch">
            <AcmePaymentDesktop version="branch" />
          </div>
          <span className="site-stage-label">main</span>
          <span className="site-stage-label site-home-tag-branch">
            feat/checkout-v2
          </span>
          <span className="site-home-swipe">
            <span className="site-home-swipe-grip">
              <SiteIcon name="caret" size={13} />
              <SiteIcon name="caret" size={13} />
            </span>
          </span>
          <SiteCursor className="site-home-compare-sam" person="sam" />
        </div>
      </div>
    </div>
  );
}
