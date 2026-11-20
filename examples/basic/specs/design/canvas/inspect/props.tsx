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
 * Welcome's four frames with Inspect's Props section unfolded: the controls
 * that edit the screen's own props. On a phone, the Inspect sheet holds the
 * unfolded section.
 */
function Props({ viewport }: { viewport: ArtboardViewport }) {
  const entry = CANVAS_ENTRIES.welcome;
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "welcome" }}
      compactZoom={FITS.phone}
      design={CANVAS_PAGES.props}
      entry={entry}
      panel={<WelcomeInspect initial="props" open={["props"]} />}
      sheet="panel"
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

export const canvasPropsScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "Inspect with Props unfolded: the form that edits Welcome's own props, here its one prop, Empty workspace. On a phone, the Inspect sheet holds the unfolded section.",
  ...artboards({
    desktop: <Props viewport="desktop" />,
    mobile: <Props viewport="mobile" />,
  }),
  slug: "props",
  rationale:
    "Editing an entry's props stays one click away in Inspect, beside the selection, so a reader can try a state without leaving the canvas.",
  title: "Props",
});
