import { defineScreen } from "@mokly/mokly";

import { artboards } from "../parts/artboards.js";
import type { ArtboardViewport } from "../parts/shell.js";

import { CANVAS_PAGES } from "./parts/destinations.js";
import { CANVAS_ENTRIES } from "./parts/entries.js";
import { WelcomeInspect } from "./parts/inspect_entries.js";
import { canvasDesignMetadata } from "./parts/metadata.js";
import { CanvasShell } from "./parts/shell.js";
import { FITS, WELCOME_VIEW, welcomeFrames } from "./parts/sketches.js";
import { CanvasStage } from "./parts/stage.js";

/**
 * The canonical Canvas state: Welcome, changed on the canonical branch, as
 * four frames at one zoom, with Inspect selected and nothing selected on the
 * canvas, and the catalogue in All.
 */
function Overview({ viewport }: { viewport: ArtboardViewport }) {
  const entry = CANVAS_ENTRIES.welcome;
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "welcome" }}
      compactZoom={FITS.phone}
      design={CANVAS_PAGES.overview}
      entry={entry}
      panel={<WelcomeInspect />}
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

export const canvasOverviewScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "The Canvas viewer: a screen opens as four frames on a dot-grid canvas, between the floating catalogue and the right panel. On a phone, one frame with the dock.",
  ...artboards({
    desktop: <Overview viewport="desktop" />,
    mobile: <Overview viewport="mobile" />,
  }),
  slug: "overview",
  rationale:
    "A reader sees every viewport and scheme of a screen at once, as frames in a design file, and keeps the catalogue and the inspector beside them. The right panel shows Changes only for an entry that the branch changed.",
  title: "Canvas viewer",
});
