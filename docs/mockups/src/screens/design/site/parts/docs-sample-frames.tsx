/**
 * The drawn frames of the HTML sample band, one for each view. The screen
 * has no CSS, so each view shows its body in the browser's default type,
 * light in both site schemes, with the heading selected and tagged as the
 * lit line's element. Each frame carries its label and a selection with the
 * size tag of the view's full size.
 *
 * - Mobile: the phone's status band over the body, at the canvas zoom of
 *   60%.
 * - Desktop: the 1280 × 800 view in the browser window of the shell's
 *   browser frame: the bar with its three lights and its address field, then
 *   the body. The window scales with its frame's width, so the band can fit
 *   it beside the code or set it wider when it stacks.
 */

import { SiteFrameLabel } from "./frame-label.js";
import { SiteSelection, SiteSizeTag } from "./selection.js";

/**
 * The screen's body: the heading, selected and tagged, the paragraph that
 * the Welcome state renders, and the navigation line of the chosen view.
 */
function SampleBody({ navigation }: { navigation: string }) {
  return (
    <div className="site-docs-sample-page">
      <div className="site-docs-sample-heading">
        <span className="site-docs-sample-pick">
          Welcome, Ada
          <SiteSelection handles="none" />
          <SiteSizeTag className="site-docs-sample-tag">h1</SiteSizeTag>
        </span>
      </div>
      <div className="site-docs-sample-text">Your workspace is ready.</div>
      <div className="site-docs-sample-text">{navigation}</div>
    </div>
  );
}

/** The drawn mobile frame: the phone's status band, then the body. */
export function SampleMobileFrame() {
  return (
    <div className="site-docs-sample-frame">
      <SiteFrameLabel icon="phone" name="Mobile" />
      <div className="site-docs-sample-screen">
        <div className="site-docs-sample-status">
          <b>9:41</b>
          <span className="site-docs-sample-glyphs">
            <span />
            <span />
            <span />
          </span>
        </div>
        <SampleBody navigation="Compact navigation" />
      </div>
      <SiteSelection size="390 × 844" />
    </div>
  );
}

/**
 * The drawn desktop frame: the browser window with its bar, then the body.
 * The whole window keeps the light paper and ink of a page without CSS in
 * both site schemes, as the Mobile view's status band does.
 */
export function SampleDesktopFrame() {
  return (
    <div className="site-docs-sample-frame site-docs-sample-frame--desktop">
      <SiteFrameLabel icon="desktop" name="Desktop" />
      <div className="site-docs-sample-screen site-docs-sample-screen--desktop">
        <div className="site-docs-sample-browser">
          <span className="site-docs-sample-lights" />
          <span className="site-docs-sample-address" />
        </div>
        <SampleBody navigation="Full navigation" />
      </div>
      <SiteSelection size="1280 × 800" />
    </div>
  );
}
