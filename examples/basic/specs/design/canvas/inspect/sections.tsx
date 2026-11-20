import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { WelcomeInspect } from "../parts/inspect_welcome.js";
import {
  WELCOME_INSTANCES,
  type WelcomeInstanceId,
} from "../parts/instance_records.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { selectionOverlays } from "../parts/selection.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS, WELCOME_VIEW, welcomeFrames } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

/** The View details Action, which this state keeps selected. */
const SELECTED: WelcomeInstanceId = "details";

/**
 * The selection of View details, with Inspect's Usage and Components
 * sections unfolded below the Selection section. On a phone, the Inspect
 * sheet is expanded over the frame, with the same sections.
 */
function Sections({ viewport }: { viewport: ArtboardViewport }) {
  const entry = CANVAS_ENTRIES.welcome;
  const instance = WELCOME_INSTANCES[SELECTED];
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "welcome" }}
      compactZoom={FITS.phone}
      design={CANVAS_PAGES.sections}
      entry={entry}
      expanded
      panel={
        <WelcomeInspect
          design={CANVAS_PAGES.sections}
          initial="selection"
          open={["usage", "components"]}
          selected={SELECTED}
        />
      }
      sheet="panel"
      viewport={viewport}
      zoom={100}
    >
      <CanvasStage
        entry={entry}
        frames={welcomeFrames()}
        overlays={selectionOverlays(instance)}
        pan="end"
        view={WELCOME_VIEW}
        zoom={100}
      />
    </CanvasShell>
  );
}

export const canvasSectionsScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "Inspect with Usage and Components unfolded: Welcome's consumers, which a screen has none of, and its component tree, where each instance opens its selection. On a phone, the expanded Inspect sheet holds the same sections.",
  ...artboards({
    desktop: <Sections viewport="desktop" />,
    mobile: <Sections viewport="mobile" />,
  }),
  slug: "sections",
  rationale:
    "Usage and the component tree are sections of Inspect, so one right panel holds every part of the inspector: the details, the props, the usage, and the components.",
  title: "Usage and components",
});
