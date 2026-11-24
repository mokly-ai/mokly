/**
 * The shared site chrome: the sticky tool bar of the design file, the open
 * mobile menu when a screen asks for it, and the footer frame. The tool bar
 * holds the brand, the file title `mokly.ai — {page}` with its `main` branch
 * chip and the people in the file, which are depicted, then the navigation
 * and Get started. On the mobile composition the bar keeps the brand, Get
 * started and the menu control, and the navigation moves into the menu.
 */

import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { SiteBrand } from "./brand.js";
import { SiteFooter } from "./footer.js";
import { SiteChip } from "./labels.js";
import {
  EXTERNAL_LINKS,
  GET_STARTED_SCREEN,
  SITE_NAV_SCREENS,
  SITE_PAGE_NAMES,
  currentPage,
  type SiteScreen,
} from "./links.js";
import { SiteMenu, SiteMenuButton } from "./menu.js";
import { SitePresence } from "./people.js";
import { zoomRoot } from "./zoom-pill.js";

/** The file title of the design file: the site, the page and the branch. */
function FileTitle({ active }: { active: SiteScreen }) {
  return (
    <div aria-hidden="true" className="site-header-title">
      <span className="site-file">
        <span className="site-file-team">mokly.ai</span>
        <span className="site-file-dash">—</span>
        <span className="site-file-name">{SITE_PAGE_NAMES[active]}</span>
      </span>
      <SiteChip icon="branch" mono>
        main
      </SiteChip>
    </div>
  );
}

/**
 * The tool bar: the brand, the file title, the people in the file, the
 * navigation with the current page marked, Get started and, on the mobile
 * composition, the menu control.
 */
function SiteHeader({ active, menu }: { active: SiteScreen; menu: boolean }) {
  return (
    <header className="site-header">
      <div className="site-header-start">
        <SiteBrand active={active} />
      </div>
      <FileTitle active={active} />
      <div className="site-header-end">
        {/* status: "ahead" (Claude, Codex) */}
        <SitePresence className="site-header-presence" />
        <nav aria-label="Main" className="site-nav">
          {SITE_NAV_SCREENS.map(([screen, label]) => (
            <MockLink
              aria-current={currentPage(active, screen)}
              className="site-nav-link"
              key={screen}
              to={screen}
            >
              {label}
            </MockLink>
          ))}
          <a className="site-nav-link" href={EXTERNAL_LINKS.github}>
            GitHub
          </a>
        </nav>
        <MockLink
          className="site-button site-button--primary site-header-cta"
          to={GET_STARTED_SCREEN}
        >
          Get started{" "}
          <span aria-hidden="true" className="site-button-arrow">
            &#8594;
          </span>
        </MockLink>
        <SiteMenuButton open={menu} />
      </div>
    </header>
  );
}

/**
 * Skip link, tool bar, page content and footer, in order. `active` names
 * the rendered screen: it marks the current page and names the page in the
 * file title and the status bar. `menu` draws the mobile menu open over the
 * page; the desktop composition has no menu, so it draws the page as is.
 * `zoom` is the home's zoom, where 1 is 100%: the footer frame takes it,
 * and the home's `main` takes it from the home screen. Above 100% the root
 * takes it too, so the page grows sideways by the zoom.
 */
export function SiteLayout({
  active,
  children,
  menu = false,
  viewport,
  zoom = 1,
}: {
  active: SiteScreen;
  children: ReactNode;
  menu?: boolean | undefined;
  viewport: "mobile" | "desktop";
  zoom?: number | undefined;
}) {
  const open = menu && viewport === "mobile";
  return (
    <div {...zoomRoot(zoom)} data-site-viewport={viewport}>
      <a className="site-skip" href="#main">
        Skip to content
      </a>
      <div className="site-band">
        <SiteHeader active={active} menu={open} />
      </div>
      {open ? <SiteMenu active={active} /> : null}
      {children}
      <SiteFooter active={active} zoom={zoom} />
    </div>
  );
}
