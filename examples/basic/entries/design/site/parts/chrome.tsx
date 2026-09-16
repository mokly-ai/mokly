/**
 * The shared site chrome: a header band on the page canvas holding one
 * header row, and a footer whose seven site destinations are grouped into
 * columns. The documentation search sits in the header beside the
 * navigation; the location trail is set as the eyebrow above a page title.
 */

import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { SiteBrand } from "./brand.js";
import { SearchGlyph } from "./glyphs.js";
import {
  APP_LINKS,
  SITE_SCREENS,
  currentPage,
  type SiteScreen,
} from "./links.js";
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

function SiteHeader({
  active,
  search,
}: {
  active: SiteScreen;
  search: boolean;
}) {
  return (
    <header
      className={search ? "site-header site-header--search" : "site-header"}
    >
      <SiteBrand active={active} />
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
          className="site-nav-link site-desktop-only"
          to={SITE_SCREENS.changelog}
        >
          Changelog
        </MockLink>
        <a className="site-nav-link" href={APP_LINKS.signIn}>
          Sign in
        </a>
        <a
          className="site-button site-button--secondary site-desktop-only"
          href={APP_LINKS.signUp}
        >
          Get started <span aria-hidden="true">&#8594;</span>
        </a>
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
          <div className="site-footer-group">
            <p className="site-footer-heading">Account</p>
            <a className="site-footer-link" href={APP_LINKS.signIn}>
              Sign in
            </a>
            <a className="site-footer-link" href={APP_LINKS.signUp}>
              Get started
            </a>
          </div>
          <FooterGroup
            active={active}
            screens={[
              [SITE_SCREENS.terms, "Terms"],
              [SITE_SCREENS.privacy, "Privacy"],
            ]}
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
 * content below, while the home lets the hero follow it directly.
 */
export function SiteLayout({
  active,
  children,
  ruled = true,
  search = false,
  viewport,
}: {
  active: SiteScreen;
  children: ReactNode;
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
        <SiteHeader active={active} search={search} />
      </div>
      {children}
      <SiteFooter active={active} />
    </div>
  );
}
