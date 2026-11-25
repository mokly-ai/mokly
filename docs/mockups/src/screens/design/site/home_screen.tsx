/**
 * The home: the hero with its selected heading layer and the spread of the
 * depicted acme/storefront app, then the workspace, where the Specs panel
 * floats beside the frames on the desktop composition: the features intro,
 * the Browse, Review and Edit frames and the open foundation. The zoom pill
 * in the status bar scales the hero, the workspace and the footer frame,
 * and the Specs panel keeps its size and its place.
 */

import "./styles/shared.js";
import "./styles/home.js";

import { HomeHero } from "./home/hero.js";
import { HomeWorkspace } from "./home/workspace.js";
import { SiteLayout } from "./parts/chrome.js";
import { SITE_SCREENS } from "./parts/links.js";
import { ZOOM_RANGE } from "./parts/zoom-pill.js";

/**
 * The zooms that the zoom states draw, each one that the pill's steps reach
 * from 100%: four presses of Zoom out, 0.8 to the fourth power, and the end
 * of the range, 200%, which the fourth press of Zoom in reaches, because
 * 1.25 to the fourth power passes it.
 */
const ZOOMED_OUT = 0.4096;
const ZOOMED_IN = ZOOM_RANGE.max;

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
      <main className="site-main" id="main">
        <HomeHero viewport={viewport} zoom={zoom} />
        <HomeWorkspace viewport={viewport} zoom={zoom} />
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

/**
 * The home zoomed out to 41%, with the pill showing that zoom. The content
 * keeps its layout of 100% at the window's width, 41% as large, at the
 * centre of the window's width, and the Specs panel keeps its size and its
 * place at the window's start.
 */
export function SiteHomeZoomedOutScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <SiteHome viewport={viewport} zoom={ZOOMED_OUT} />;
}

/**
 * The home zoomed in to 200%, the end of the range, with the pill showing
 * that zoom and Zoom in at its end. The content keeps its layout of 100%
 * at the window's width, twice as large, so the page scrolls sideways, and
 * the Specs panel keeps its size and its place at the window's start.
 */
export function SiteHomeZoomedInScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <SiteHome viewport={viewport} zoom={ZOOMED_IN} />;
}
