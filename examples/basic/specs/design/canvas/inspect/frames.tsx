import { defineScreen } from "@mokly/mokly";

import { artboards, type ArtboardViewport } from "../../parts/artboards.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { WelcomeInspect } from "../parts/inspect_welcome.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS, welcomeFrames, welcomeHighlighted } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

/** The Frames filter with Dark turned off and Highlight components on. */
const LIGHT_HIGHLIGHTED = {
  count: 2,
  filter: {
    viewports: true,
    mobile: true,
    desktop: true,
    light: true,
    dark: false,
    highlight: true,
  },
} as const;

/**
 * Welcome with the Frames filter's Dark turned off, so the stage refits
 * around the two Light frames at 42%, and Highlight components on, so the
 * shipped mask outlines the registered instances on each frame. Below 60%,
 * the frames draw no labels. On a phone, the one frame shows the highlight
 * with its labels, and the frame picker lists the shown frames.
 */
function Frames({ viewport }: { viewport: ArtboardViewport }) {
  const entry = CANVAS_ENTRIES.welcome;
  const frames = welcomeFrames();
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "welcome" }}
      compactZoom={FITS.phone}
      design={CANVAS_PAGES.frames}
      entry={entry}
      panel={<WelcomeInspect frames={LIGHT_HIGHLIGHTED} initial="frames" />}
      viewport={viewport}
      zoom={FITS.welcomeLight}
    >
      <CanvasStage
        entry={entry}
        frames={frames}
        pickable={frames.filter((frame) => frame.scheme === "light")}
        view={welcomeHighlighted()}
        zoom={FITS.welcomeLight}
      />
    </CanvasShell>
  );
}

export const canvasFramesScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "The Frames filter with Dark turned off, so the stage refits around Desktop · Light and Mobile · Light at 42%, and Highlight components on, so each frame outlines Welcome's registered instances. Below 60%, the frames draw no labels. On a phone, the one frame shows the highlight with its labels, and the frame picker lists the shown frames.",
  ...artboards({
    desktop: <Frames viewport="desktop" />,
    mobile: <Frames viewport="mobile" />,
  }),
  slug: "frames",
  rationale:
    "The Frames filter replaces the viewport dropdown: a reader keeps the frames they compare on the canvas, and the switch that highlights the components sits beside them.",
  title: "Frames filter",
});
