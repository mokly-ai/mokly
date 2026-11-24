/**
 * The open screen of the depicted Mokly viewer in the Browse frame, as the
 * product's Browse draws it: the screen's section centred on the dot-grid
 * canvas, headed by its title in a dark tag and its path, with the
 * Mobile · Light frame of the acme `pricing` screen. The depicted Frames
 * filter shows Mobile and Light only, so the section holds one phone frame,
 * and Browse draws no compare.
 */

import { SiteSectionBox } from "../parts/labels.js";

import { AcmePricingPhone } from "./acme/acme-pricing.js";
import { Artboard } from "./artboard.js";

/** The canvas of the open screen. */
export function ViewerCanvas() {
  return (
    <div className="site-shell-main">
      <div className="site-stage">
        <SiteSectionBox
          className="site-home-links-section"
          meta="pricing"
          tag="Pricing"
        >
          <Artboard device="phone" name="Mobile · Light">
            <AcmePricingPhone />
          </Artboard>
        </SiteSectionBox>
      </div>
    </div>
  );
}
