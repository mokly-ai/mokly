/**
 * The footer: the last frame on the canvas, labelled Footer. It pairs the
 * brand, the line about the open-source CLI and the scheme control with the
 * Product and Legal groups, and the design file's status bar runs under it:
 * the file title, the people in the file and the zoom. The status bar is a
 * depiction, except the home's zoom pill, which is a control.
 */

import { MockLink } from "@mokly/mokly";

import { SiteBrand } from "./brand.js";
import { SiteFrameLabel } from "./frame-label.js";
import { SiteIcon } from "./icons.js";
import {
  SITE_LEGAL_SCREENS,
  SITE_PAGE_NAMES,
  SITE_PRODUCT_SCREENS,
  SITE_SCREENS,
  currentPage,
  type SiteScreen,
} from "./links.js";
import { SITE_PEOPLE, SitePresence } from "./people.js";
import { SiteSchemeControl } from "./scheme-control.js";
import { SiteZoomControl, SiteZoomDepiction, zoomStyle } from "./zoom-pill.js";

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

/**
 * The status bar under the footer frame, a depiction of the design file. On
 * the home the zoom pill is a control, so the bar stays visible to assistive
 * technology and the file and the people hide themselves.
 */
function StatusBar({ active, zoom }: { active: SiteScreen; zoom: number }) {
  const home = active === SITE_SCREENS.home;
  const depicted = home ? "true" : undefined;
  return (
    <div aria-hidden={home ? undefined : "true"} className="site-statusbar">
      <span
        aria-hidden={depicted}
        className="site-statusbar-item site-statusbar-file"
      >
        <SiteIcon name="frame" size={14} />
        mokly.ai — {SITE_PAGE_NAMES[active]}
      </span>
      {/* status: "ahead" (Claude, Codex) */}
      <span aria-hidden={depicted} className="site-statusbar-item">
        <SitePresence small />
        {SITE_PEOPLE.length} in this file
      </span>
      {home ? <SiteZoomControl zoom={zoom} /> : <SiteZoomDepiction />}
    </div>
  );
}

/**
 * The footer frame and the status bar of the rendered page. Its `footer` id
 * is the target of the home Specs panel's Footer row. `zoom` is the home's
 * zoom, where 1 is 100%: it zooms the frame, and the status bar's pill shows
 * it.
 */
export function SiteFooter({
  active,
  zoom = 1,
}: {
  active: SiteScreen;
  zoom?: number | undefined;
}) {
  return (
    <footer className="site-footer" id="footer">
      <div className="site-footer-inner" style={zoomStyle(zoom)}>
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
      <StatusBar active={active} zoom={zoom} />
    </footer>
  );
}
