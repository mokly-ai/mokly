/**
 * The footer: the last frame on the canvas, labelled Footer. It pairs the
 * brand, the line about the open-source CLI and the scheme control with the
 * Product and Legal groups, and the design file's status bar runs under it:
 * the file title, the people in the file and the zoom, all depicted.
 */

import { MockLink } from "@mokly/mokly";

import { SiteBrand } from "./brand.js";
import { SiteFrameLabel } from "./frame-label.js";
import { SiteIcon } from "./icons.js";
import {
  SITE_LEGAL_SCREENS,
  SITE_PAGE_NAMES,
  SITE_PRODUCT_SCREENS,
  currentPage,
  type SiteScreen,
} from "./links.js";
import { SITE_PEOPLE, SitePresence } from "./people.js";
import { SiteSchemeControl } from "./scheme-control.js";

function FooterGroup({
  active,
  screens,
  title,
}: {
  active: SiteScreen;
  screens: ReadonlyArray<readonly [SiteScreen, string]>;
  title: string;
}) {
  return (
    <div className="site-footer-group">
      <p className="site-footer-heading">{title}</p>
      {screens.map(([screen, label]) => (
        <MockLink
          aria-current={currentPage(active, screen)}
          className="site-footer-link"
          key={screen}
          to={screen}
        >
          {label}
        </MockLink>
      ))}
    </div>
  );
}

/** The status bar under the footer frame, a depiction of the design file. */
function StatusBar({ active }: { active: SiteScreen }) {
  return (
    <div aria-hidden="true" className="site-statusbar">
      <span className="site-statusbar-item site-statusbar-file">
        <SiteIcon name="frame" size={14} />
        mokly.ai — {SITE_PAGE_NAMES[active]}
      </span>
      {/* status: "ahead" (Claude, Codex) */}
      <span className="site-statusbar-item">
        <SitePresence small />
        {SITE_PEOPLE.length} in this file
      </span>
      <span className="site-statusbar-zoom">
        <span>−</span>
        100%
        <span>+</span>
      </span>
    </div>
  );
}

/**
 * The footer frame and the status bar of the rendered page. Its `footer` id
 * is the target of the home Specs panel's Footer row.
 */
export function SiteFooter({ active }: { active: SiteScreen }) {
  return (
    <footer className="site-footer" id="footer">
      <div className="site-footer-inner">
        <SiteFrameLabel name="Footer" />
        <div className="site-footer-brand">
          <SiteBrand active={active} />
          <p>The Mokly CLI is open source under the MIT license.</p>
          <SiteSchemeControl />
        </div>
        <nav aria-label="Footer" className="site-footer-nav">
          <FooterGroup
            active={active}
            screens={SITE_PRODUCT_SCREENS}
            title="Product"
          />
          <FooterGroup
            active={active}
            screens={SITE_LEGAL_SCREENS}
            title="Legal"
          />
        </nav>
      </div>
      <StatusBar active={active} />
    </footer>
  );
}
