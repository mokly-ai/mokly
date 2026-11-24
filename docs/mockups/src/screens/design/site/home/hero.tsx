/**
 * The home hero on the canvas: `Design in code.` as a selected text layer
 * with its eight handles, its name tag, its type badge and its size tag,
 * the green spacing redline under it and Maya's cursor on the resize
 * handle; then the lead and the two actions, and the spread of the
 * acme/storefront app. The measurements are the rendered ones of each
 * composition: the heading runs at 162px on one line on the desktop and at
 * 82px on two lines on a phone, where the type badge leaves the layer. The
 * home's zoom scales the hero as one part, and the measurements keep their
 * values of 100%.
 */

import { SiteActions } from "../parts/actions.js";
import { SiteCursor } from "../parts/people.js";
import { SiteRedline, SiteSelection } from "../parts/selection.js";
import { zoomStyle } from "../parts/zoom-pill.js";

import { Spread } from "./spread.js";

/** The measurements of the heading layer on each composition. */
const LAYER = {
  desktop: { gap: "60", size: "1033 × 156", type: "162" },
  mobile: { gap: "52", size: "350 × 157", type: undefined },
} as const;

/**
 * The hero section, with the spread under its copy. `zoom` is the home's
 * zoom, where 1 is 100%.
 */
export function HomeHero({
  viewport,
  zoom,
}: {
  viewport: "mobile" | "desktop";
  zoom: number;
}) {
  const layer = LAYER[viewport];
  return (
    <section
      aria-labelledby="home-title"
      className="site-hero"
      id="hero"
      style={zoomStyle(zoom)}
    >
      <div className="site-home-hero-inner">
        <div className="site-home-title-layer">
          <h1 id="home-title">{"Design in\u00a0code."}</h1>
          <SiteSelection
            badge={
              layer.type === undefined ? undefined : (
                <>
                  Geist Semibold <b>{layer.type}</b>
                </>
              )
            }
            className="site-home-title-sel"
            handles="all"
            name="Heading"
            size={layer.size}
          />
          <SiteCursor className="site-home-hero-maya" person="maya" />
        </div>
        <div className="site-home-hero-group">
          <div className="site-home-hero-copy">
            <SiteRedline className="site-home-hero-redline" value={layer.gap} />
            <p className="site-hero-lead">
              Generate an interactive mockup of your entire app using your
              existing React, HTML and CSS components.
            </p>
          </div>
          <SiteActions secondary="download" />
        </div>
      </div>
      <Spread viewport={viewport} />
    </section>
  );
}
