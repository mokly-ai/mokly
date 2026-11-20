import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { EmptyState } from "../../parts/stage_content.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";

/**
 * The catalogue home: nothing is selected, so the canvas holds the home
 * guidance and no right panel shows. On a phone, the catalogue sheet is open.
 */
function Home({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <CanvasShell
      catalogue={{ filter: "all" }}
      design={CANVAS_PAGES.home}
      sheet="catalogue"
      viewport={viewport}
    >
      <div className="cv-view">
        <div className="cv-home">
          <EmptyState
            body="Browse the mockup catalogue: expand folders and choose an item from the navigation."
            linkLabel="Open the first screen"
            title="Mokly"
            to={CANVAS_PAGES.overview}
          />
        </div>
      </div>
    </CanvasShell>
  );
}

export const canvasHomeScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "The catalogue home: nothing is selected, so the canvas holds the home guidance beside the catalogue, with no right panel. On a phone, the catalogue sheet is open.",
  ...artboards({
    desktop: <Home viewport="desktop" />,
    mobile: <Home viewport="mobile" />,
  }),
  slug: "home",
  title: "Home",
});
