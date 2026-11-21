import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { WelcomeInspect } from "../parts/inspect_welcome.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS, WELCOME_VIEW, welcomeFrames } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

/**
 * The catalogue in the Changes filter with Welcome selected. On a phone, the
 * catalogue sheet is open over the Welcome frame.
 */
function Catalogue({ viewport }: { viewport: ArtboardViewport }) {
  const entry = CANVAS_ENTRIES.welcome;
  return (
    <CanvasShell
      catalogue={{ filter: "changes", activeKey: "welcome" }}
      compactZoom={FITS.phone}
      design={CANVAS_PAGES.catalogue}
      entry={entry}
      panel={<WelcomeInspect />}
      sheet="catalogue"
      viewport={viewport}
      zoom={FITS.welcome}
    >
      <CanvasStage
        entry={entry}
        frames={welcomeFrames()}
        view={WELCOME_VIEW}
        zoom={FITS.welcome}
      />
    </CanvasShell>
  );
}

export const canvasCatalogueScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "The catalogue in the Changes filter, which lists the ten entries that the branch changed and names the base it compares with. On a phone, the catalogue opens as a sheet from the dock.",
  ...artboards({
    desktop: <Catalogue viewport="desktop" />,
    mobile: <Catalogue viewport="mobile" />,
  }),
  slug: "catalogue",
  title: "Catalogue",
});
