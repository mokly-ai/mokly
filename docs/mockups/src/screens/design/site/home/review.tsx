/**
 * Frame 03 Review: on the desktop composition the frame sits left and the
 * copy right. The frame holds the desktop pricing artboards, light and dark,
 * behind the mobile one, whose PriceCard is selected with its 16px padding
 * redline and Maya's pin; the comment thread spills out of the frame onto
 * the canvas. On a phone the copy leads and the thread follows the frame.
 */
// status: "ahead" (comments, approvals)

import { AcmePricingDesktop, AcmePricingPhone } from "./acme/acme-pricing.js";
import { Artboard } from "./artboard.js";
import { CardSelection } from "./card-selection.js";
import { ModuleFrame, ModuleText } from "./module.js";
import { Thread } from "./thread.js";

/** The Review module. */
export function ReviewModule({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <article
      aria-labelledby="review-title"
      className="site-module site-module--review"
      id="review"
    >
      <ModuleText
        headingId="review-title"
        index="03"
        kicker="Review"
        title="Sticky comments."
      >
        Each comment is tied to the component it is about, so it stays put when
        the layout changes. Approve when it is right, in step with the pull
        request review.
      </ModuleText>
      <ModuleFrame name="03 Review">
        <div aria-hidden="true" className="site-detail">
          {viewport === "desktop" ? (
            <div className="site-home-review-desk">
              <Artboard device="desktop" name="pricing">
                <AcmePricingDesktop padding={16} tone="secondary" />
              </Artboard>
              <Artboard dark device="desktop" name="pricing">
                <AcmePricingDesktop dark padding={16} tone="secondary" />
              </Artboard>
            </div>
          ) : null}
          <Artboard
            className="site-home-review-phone"
            device="phone"
            name="pricing"
            overlay={<CardSelection padding="16" pin />}
          >
            <AcmePricingPhone padding={16} tone="secondary" />
          </Artboard>
        </div>
        <Thread />
      </ModuleFrame>
    </article>
  );
}
