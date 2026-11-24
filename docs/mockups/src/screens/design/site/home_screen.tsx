/**
 * The home: the hero with its selected heading layer and the spread of the
 * depicted acme/storefront app, then the workspace, where the Specs panel
 * floats beside the frames on the desktop composition: the features intro,
 * the Browse, Review and Edit frames and the open foundation.
 */

import { HomeHero } from "./home/hero.js";
import { HomeWorkspace } from "./home/workspace.js";
import { SiteLayout } from "./parts/chrome.js";
import { SITE_SCREENS } from "./parts/links.js";

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
        <HomeHero viewport={viewport} />
        <HomeWorkspace viewport={viewport} />
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
