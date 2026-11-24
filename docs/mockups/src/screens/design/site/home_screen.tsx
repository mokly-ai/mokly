/**
 * The home: the hero with its selected heading layer and the spread of the
 * depicted acme/storefront app, then the workspace, where the Specs panel
 * floats beside the frames on the desktop composition: the features intro,
 * the Browse, Review and Edit frames and the open foundation. The zoom pill
 * in the status bar zooms the page's `main` and its footer frame.
 */

import { HomeHero } from "./home/hero.js";
import { HomeWorkspace } from "./home/workspace.js";
import { SiteLayout } from "./parts/chrome.js";
import { SITE_SCREENS } from "./parts/links.js";
import { zoomStyle } from "./parts/zoom-pill.js";

/**
 * The zooms that the zoom states draw, each one that the pill's steps reach
 * from 100%: four presses of Zoom out, 0.8 to the fourth power, and two
 * presses of Zoom in, 1.25 squared.
 */
const ZOOMED_OUT = 0.4096;
const ZOOMED_IN = 1.5625;

function SiteHome({
  menu = false,
  viewport,
  zoom = 1,
}: {
  menu?: boolean;
  viewport: "mobile" | "desktop";
  zoom?: number;
}) {
  return (
    <SiteLayout
      active={SITE_SCREENS.home}
      menu={menu}
      viewport={viewport}
      zoom={zoom}
    >
      <main className="site-main" id="main" style={zoomStyle(zoom)}>
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

/** The home zoomed out to 41%, with the pill showing that zoom. */
export function SiteHomeZoomedOutScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <SiteHome viewport={viewport} zoom={ZOOMED_OUT} />;
}

/** The home zoomed in to 156%, with the pill showing that zoom. */
export function SiteHomeZoomedInScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <SiteHome viewport={viewport} zoom={ZOOMED_IN} />;
}
