/**
 * The shared site chrome: a header band on the page canvas holding one
 * header row, and a footer whose seven destinations are grouped into
 * columns. The documentation search sits in the header beside the
 * navigation; below the breakpoint the navigation moves into the menu and
 * the search takes the row beneath. The location trail is set as the
 * eyebrow above a page title.
 */

import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { SiteBrand } from "./brand.js";
import { SearchGlyph } from "./glyphs.js";
import {
  EXTERNAL_LINKS,
  GET_STARTED_SCREEN,
  SITE_LEGAL_SCREENS,
  SITE_SCREENS,
  currentPage,
  type SiteScreen,
} from "./links.js";
import { SiteMenu, SiteMenuButton } from "./menu.js";
import { PACKAGE_VERSION } from "./version.js";

/** The location trail, set as the eyebrow line above the page title. */
export function SiteTrail({ trail }: { trail: readonly string[] }) {
  return (
    <nav aria-label="Location" className="site-trail">
      {trail.map((step, index) => (
        <span className="site-trail-step" key={step}>
          {index > 0 ? (
            <span aria-hidden="true" className="site-trail-sep">
              &#8250;
            </span>
          ) : null}
          {step}
        </span>
      ))}
    </nav>
  );
}

/** The published CLI version, shown as the shell's quiet identity chip. */
export function SiteVersion({ label }: { label: string }) {
  return (
    <span className="site-version">
      <span className="site-version-label">{label}</span>
      {PACKAGE_VERSION}
    </span>
  );
}

/** The documentation search control, shaped like the catalogue's own. */
export function SiteSearch() {
  return (
    <button className="site-search" type="button">
      <SearchGlyph />
      Search docs
    </button>
  );
}

/**
 * The brand, the menu control, the documentation search and the
 * navigation, in reading order. The open menu is drawn only on the mobile
 * composition, where its control is.
 */
function SiteHeader({
  active,
  menu,
  search,
}: {
  active: SiteScreen;
  menu: boolean;
  search: boolean;
}) {
  return (
    <header className="site-header">
      <SiteBrand active={active} />
      <SiteMenuButton open={menu} />
      {menu ? <SiteMenu active={active} /> : null}
      {search ? <SiteSearch /> : null}
      <nav aria-label="Main" className="site-nav">
        <MockLink
          aria-current={currentPage(active, SITE_SCREENS.docs)}
          className="site-nav-link"
          to={SITE_SCREENS.docs}
        >
          Docs
        </MockLink>
        <MockLink
          aria-current={currentPage(active, SITE_SCREENS.changelog)}
          className="site-nav-link"
          to={SITE_SCREENS.changelog}
        >
          Changelog
        </MockLink>
        <a className="site-nav-link" href={EXTERNAL_LINKS.github}>
          GitHub
        </a>
        <MockLink
          className="site-button site-button--secondary"
          to={GET_STARTED_SCREEN}
        >
          Get started <span aria-hidden="true">&#8594;</span>
        </MockLink>
      </nav>
    </header>
  );
}

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

function SiteFooter({ active }: { active: SiteScreen }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <SiteBrand active={active} />
          <p>The Mokly CLI is open source under the MIT license.</p>
        </div>
        <nav aria-label="Footer" className="site-footer-nav">
          <FooterGroup
            active={active}
            screens={[
              [SITE_SCREENS.home, "Home"],
              [SITE_SCREENS.docs, "Docs"],
              [SITE_SCREENS.changelog, "Changelog"],
            ]}
            title="Product"
          />
          <FooterGroup
            active={active}
            screens={SITE_LEGAL_SCREENS}
            title="Legal"
          />
        </nav>
      </div>
    </footer>
  );
}

/**
 * Skip link, header band, page content and grouped footer, in order. The
 * band sits on the page canvas; structured pages rule it off from the
 * content below, while the home lets the hero follow it directly. `menu`
 * draws the mobile menu open over the page.
 */
export function SiteLayout({
  active,
  children,
  menu = false,
  ruled = true,
  search = false,
  viewport,
}: {
  active: SiteScreen;
  children: ReactNode;
  menu?: boolean;
  ruled?: boolean;
  search?: boolean;
  viewport: "mobile" | "desktop";
}) {
  return (
    <div className="site-root" data-site-viewport={viewport}>
      <a className="site-skip" href="#main">
        Skip to content
      </a>
      <div className={ruled ? "site-band site-band--ruled" : "site-band"}>
        <SiteHeader
          active={active}
          menu={menu && viewport === "mobile"}
          search={search}
        />
      </div>
      {children}
      <SiteFooter active={active} />
    </div>
  );
}
