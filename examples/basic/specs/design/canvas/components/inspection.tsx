import { defineScreen } from "@mokly/mokly";

import {
  artboardStates,
  type ArtboardViewport,
} from "../../parts/artboards.js";
import { detailsFrames } from "../parts/changes_sketches.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import { EXPLORER_PAGES as E } from "./parts/destinations.js";
import {
  InspectionInspect,
  type InspectionState,
} from "./parts/inspect_states.js";
import { explorerMetadata, explorerState } from "./parts/metadata.js";

/** The artboard of each inspection state. */
const INSPECTION_PAGES = {
  waiting: E.explorerInspection,
  unavailable: E.explorerInspectionUnavailable,
} as const satisfies Record<InspectionState, string>;

/**
 * Details, which the canonical branch added, as four frames whose view's
 * usage is not ready: the frames show the preview, while Inspect waits for
 * the component preview or says that inspection is unavailable, and the
 * shell cannot highlight the view. On a phone, the Inspect sheet is open at
 * its expanded height, scrolled to Components.
 */
function Inspection({
  state,
  viewport,
}: {
  state: InspectionState;
  viewport: ArtboardViewport;
}) {
  const entry = CANVAS_ENTRIES.details;
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "details" }}
      compactZoom={FITS.phone}
      design={INSPECTION_PAGES[state]}
      entry={entry}
      expanded
      panel={<InspectionInspect state={state} />}
      sheet="panel"
      viewport={viewport}
      zoom={FITS.welcome}
    >
      <CanvasStage
        entry={entry}
        frames={detailsFrames()}
        view={{ highlight: state === "waiting" ? "loading" : "unavailable" }}
        zoom={FITS.welcome}
      />
    </CanvasShell>
  );
}

export const canvasExplorerInspectionScreen = defineScreen({
  ...explorerMetadata,
  description:
    "Screen inspection before a view's usage is ready: Details' Components section and Highlight components read Waiting for the component preview. until the frame adopts its usage, and Props waits with them.",
  ...artboardStates(
    {
      state: "waiting",
      title: "Waiting for the component preview",
      desktop: <Inspection state="waiting" viewport="desktop" />,
      mobile: <Inspection state="waiting" viewport="mobile" />,
    },
    [
      explorerState(
        "unavailable",
        "Inspection unavailable",
        "The view has no inspection metadata: Components and Highlight components say that inspection is unavailable, Props that props are unavailable, and Usage that the catalogue has not been checked. Nothing claims an empty list.",
        (viewport) => <Inspection state="unavailable" viewport={viewport} />,
      ),
    ],
  ),
  slug: "inspection",
  rationale:
    "Pending usage is neither empty nor unavailable, so each state keeps its own words, and none of them reads as a view without components.",
  title: "Screen inspection",
});
