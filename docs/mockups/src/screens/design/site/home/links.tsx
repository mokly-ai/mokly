/**
 * Frame 01 Browse: on the desktop composition the source screen sits left of
 * the copy, and the depicted viewer on the branch takes the row under both.
 * The source screen is acme's `onboarding/welcome`, where Sam's cursor
 * presses Continue; the link line runs from Continue into the viewer, where
 * `pricing` is open on the canvas and current in the catalogue column. The
 * drawing shows the finished state of that click. On a phone the copy, the
 * source screen and the viewer stack, and the viewer draws its canvas above
 * its catalogue column, so the link line reaches the open screen first.
 *
 * The module's code name is `links` until the site frees the `browse`
 * names; the page shows it as 01 Browse.
 */

import { SiteCursor } from "../parts/people.js";

import { AcmeWelcome } from "./acme/acme-welcome.js";
import { Artboard } from "./artboard.js";
import { FitConnector } from "./fit-lines.js";
import { ModuleFrame, ModuleText } from "./module.js";
import { ViewerCanvas } from "./viewer-canvas.js";
import { Viewer } from "./viewer.js";

/**
 * Sam's press on Continue: the press ring under Sam's cursor. The cursor is
 * on a demo screen outside the depicted viewer, so it is fiction of the
 * design file and carries no ahead mark.
 */
function SamPress() {
  return (
    <>
      <span className="site-home-links-press" />
      <SiteCursor className="site-home-links-sam" flip person="sam" />
    </>
  );
}

/** The Browse module. */
export function LinksModule({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <article
      aria-labelledby="browse-title"
      className="site-module site-module--links"
      id="browse"
    >
      <ModuleText
        headingId="browse-title"
        index="01"
        kicker="Browse"
        title="Click through every screen."
      >
        The screens use your real components, and their links work as in your
        app.
      </ModuleText>
      <div aria-hidden="true" className="site-home-links-source">
        <Artboard
          device="phone"
          name="onboarding/welcome"
          overlay={<SamPress />}
        >
          <AcmeWelcome />
        </Artboard>
      </div>
      <ModuleFrame name="01 Browse">
        <Viewer current="pricing" viewport={viewport}>
          <ViewerCanvas />
        </Viewer>
        {viewport === "desktop" ? (
          <>
            <FitConnector layout="links-wide" />
            <FitConnector layout="links-narrow" />
          </>
        ) : (
          <FitConnector layout="links-phone" />
        )}
      </ModuleFrame>
    </article>
  );
}
