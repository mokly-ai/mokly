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
 * Welcome zoomed to 100%, with the canvas panned onto Desktop · Light. On a
 * phone, the frame picker shows Desktop · Light.
 */
function Zoomed({ viewport }: { viewport: ArtboardViewport }) {
  const entry = CANVAS_ENTRIES.welcome;
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "welcome" }}
      compactZoom={FITS.phoneDesktop}
      design={CANVAS_PAGES.zoomed}
      entry={entry}
      panel={<WelcomeInspect />}
      viewport={viewport}
      zoom={100}
    >
      <CanvasStage
        entry={entry}
        frames={welcomeFrames()}
        pan="start"
        picked="desktop-light"
        view={WELCOME_VIEW}
        zoom={100}
      />
    </CanvasShell>
  );
}

export const canvasZoomedScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "Welcome at 100%, with the canvas panned onto Desktop · Light. Fit returns to all four frames. On a phone, the frame picker shows Desktop · Light.",
  ...artboards({
    desktop: <Zoomed viewport="desktop" />,
    mobile: <Zoomed viewport="mobile" />,
  }),
  slug: "zoomed",
  title: "Zoomed",
});
