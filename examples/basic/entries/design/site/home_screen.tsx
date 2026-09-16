/**
 * The home: a compact hero above the catalogue shell rendered at
 * full width, then the three product modules and the open-foundation
 * closing. The shell is the page's principal image, so the copy stays short
 * and the chrome carries the hierarchy.
 */

import { defineScreen } from "@mokly/mokly";

import { SiteActions } from "./parts/actions.js";
import { SiteLayout } from "./parts/chrome.js";
import { SITE_SCREENS } from "./parts/links.js";
import { SITE_METADATA } from "./parts/metadata.js";
import { SiteClosing, SiteModules } from "./parts/modules.js";
import { CatalogueFrame } from "./parts/shell.js";

function SiteHome({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <SiteLayout active={SITE_SCREENS.home} ruled={false} viewport={viewport}>
      <main className="site-main" id="main">
        <section className="site-hero">
          <p className="site-hero-eyebrow">A design tool for teams that ship</p>
          <h1>
            Design in your repository.
            <br />
            <span className="site-accent">Decide in the pull request.</span>
          </h1>
          <p className="site-hero-lead">
            Your mockups are React components in Git. Browse every branch as
            screens, review them with your team, and edit with an agent beside
            the screen.
          </p>
          <SiteActions />
          <p className="site-hero-note">Light and dark. Mobile and desktop.</p>
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

/** The home at the desktop composition: the shell spans the full measure. */
export function SiteHomeDesktop() {
  return <SiteHome viewport="desktop" />;
}

/** The home at the mobile composition: the shell keeps its top bar and stage. */
export function SiteHomeMobile() {
  return <SiteHome viewport="mobile" />;
}

export const homeScreen = defineScreen({
  ...SITE_METADATA,
  description:
    "A compact hero above the catalogue shell at full width: the top bar, the catalogue navigation, the screen header and the example Welcome screen on the stage. The frame names merged pull request #71 from this repository's changelog as its fixture.",
  desktop: <SiteHomeDesktop />,
  id: "design-site-home",
  mobile: <SiteHomeMobile />,
  route: "design/site/home.html",
  title: "Home",
  useCaseIds: ["design-site-tour"],
});
