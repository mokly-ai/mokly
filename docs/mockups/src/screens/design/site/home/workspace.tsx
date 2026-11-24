/**
 * The workspace under the hero. On the desktop composition the Specs panel
 * floats on the left and lists the page's sections; the frames take the
 * rest of the width: the features intro, the Browse, Review and Edit
 * frames, and the open foundation. On a phone the frames stack without the
 * panel.
 *
 * The stage holds the Specs panel over the workspace, whose first column
 * stays free for it, so the home's zoom can scale the workspace while the
 * panel keeps its size and its place. The panel stays before the frames in
 * the reading order.
 */

import { SitePanel, SitePanelRow } from "../parts/panel.js";
import { zoomStyle } from "../parts/zoom-pill.js";

import { BrowseModule } from "./browse.js";
import { EditModule } from "./edit.js";
import { Foundation } from "./foundation.js";
import { ReviewModule } from "./review.js";

/**
 * The Specs panel: the page's sections, as in-page links. The hero, the
 * section in view at the top of the page, is current.
 */
function SpecsPanel() {
  return (
    <SitePanel
      as="nav"
      className="site-home-specs"
      label="Page sections"
      title="Specs"
    >
      <SitePanelRow current="location" href="#hero" icon="frame">
        Hero
      </SitePanelRow>
      <SitePanelRow href="#features" icon="text">
        Browse, review, edit.
      </SitePanelRow>
      <SitePanelRow href="#browse" icon="frame">
        01 Browse
      </SitePanelRow>
      <SitePanelRow href="#review" icon="frame">
        02 Review
      </SitePanelRow>
      <SitePanelRow href="#edit" icon="frame">
        03 Edit
      </SitePanelRow>
      <SitePanelRow href="#foundation" icon="frame">
        Open foundation
      </SitePanelRow>
      <SitePanelRow href="#footer" icon="frame">
        Footer
      </SitePanelRow>
    </SitePanel>
  );
}

/**
 * The workspace of the rendered composition, on its stage. `zoom` is the
 * home's zoom, where 1 is 100%.
 */
export function HomeWorkspace({
  viewport,
  zoom,
}: {
  viewport: "mobile" | "desktop";
  zoom: number;
}) {
  return (
    <div className="site-home-stage">
      {viewport === "desktop" ? <SpecsPanel /> : null}
      <div className="site-home-workspace" style={zoomStyle(zoom)}>
        <Frames viewport={viewport} />
      </div>
    </div>
  );
}

/** The frames column: the features intro, the modules and the foundation. */
function Frames({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <div className="site-home-frames">
      <section aria-labelledby="features-title" className="site-modules">
        <div className="site-section-head" id="features">
          <h2 id="features-title">
            Browse, review, edit.
            <br />
            <span>One place for all of it.</span>
          </h2>
          <p>Every branch becomes a catalogue your whole team can open.</p>
        </div>
        <div className="site-module-grid">
          <BrowseModule viewport={viewport} />
          <ReviewModule viewport={viewport} />
          <EditModule viewport={viewport} />
        </div>
      </section>
      <Foundation viewport={viewport} />
    </div>
  );
}
