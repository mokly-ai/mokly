/**
 * The home: a compact hero above the catalogue shell rendered at
 * full width, then the three product modules and the open-foundation
 * closing. The shell is the page's principal image, so the copy stays short
 * and the chrome carries the hierarchy.
 */

import { SiteActions } from "./parts/actions.js";
import { SiteLayout } from "./parts/chrome.js";
import { SITE_SCREENS } from "./parts/links.js";
import { SiteClosing, SiteModules } from "./parts/modules.js";
import { CatalogueFrame } from "./parts/shell.js";

function SiteHome({
  menu = false,
  viewport,
}: {
  menu?: boolean;
  viewport: "mobile" | "desktop";
}) {
  return (
    <SiteLayout active={SITE_SCREENS.home} menu={menu} viewport={viewport}>
      <main className="site-main" id="main">
        <section className="site-hero">
          <h1>Mockup your entire app.</h1>
          <p className="site-hero-lead">
            Prevent AI slop and accidental clobbers, by codifying your design
            and forcing agents to align their implementation with it.
          </p>
          <SiteActions />
        </section>
        <div className="site-frame-wrap">
          <CatalogueFrame viewport={viewport} />
        </div>
        <SiteModules />
        <SiteClosing />
      </main>
    </SiteLayout>
  );
}

/** The home screen, with its composition selected by the generated viewport. */
export function SiteHomeScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <SiteHome viewport={viewport} />;
}

/**
 * The home with the mobile menu open over it. The desktop header lists the
 * same destinations in its row, so the desktop view matches the home.
 */
export function SiteHomeMenuScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <SiteHome menu viewport={viewport} />;
}
