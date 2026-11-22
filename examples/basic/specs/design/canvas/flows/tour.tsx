import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import type { FrameScheme } from "../parts/frames.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";

import { FLOW_PAGES as F, type FlowDestination } from "./parts/destinations.js";
import { UseCaseInspect } from "./parts/inspect.js";
import { UseCaseStage } from "./parts/stage.js";
import { TOUR_FITS, TOUR_STEPS, type StepFrames } from "./parts/steps.js";

/**
 * A state of the use case: the viewport that the Frames filter chooses on a
 * desktop, where a phone chooses Mobile, the scheme that it chooses on both,
 * the step that a phone's frame picker shows, and whether a phone opens the
 * panel sheet.
 */
interface UseCaseState {
  design: FlowDestination;
  viewport: ArtboardViewport;
  scheme: FrameScheme;
  picked?: number | undefined;
  sheet?: boolean | undefined;
}

const STATES = {
  tour: { design: F.useCase, viewport: "desktop", scheme: "light" },
  mobile: {
    design: F.useCaseMobile,
    viewport: "mobile",
    scheme: "light",
    sheet: true,
  },
  dark: { design: F.useCaseDark, viewport: "desktop", scheme: "dark" },
  secondStep: {
    design: F.useCaseSecondStep,
    viewport: "desktop",
    scheme: "light",
    picked: 2,
  },
} as const satisfies Record<string, UseCaseState>;

/**
 * The Example tour, selected from All, as one section of its two steps on
 * Inspect, its one tab. On a desktop, the zoom pill fits the section; on a
 * phone, the compact layout shows the picked step's Mobile frame, and the
 * dock holds Catalogue, Inspect and Fit.
 */
function UseCase({
  state,
  viewport,
}: {
  state: UseCaseState;
  viewport: ArtboardViewport;
}) {
  const entry = CANVAS_ENTRIES.tour;
  const sheet = viewport === "mobile" && state.sheet === true;
  const chosen: StepFrames = {
    viewport: viewport === "mobile" ? viewport : state.viewport,
    scheme: state.scheme,
  };
  const zoom = TOUR_FITS[state.viewport];
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "example/tour" }}
      compactZoom={FITS.phone}
      design={state.design}
      entry={entry}
      panel={<UseCaseInspect chosen={chosen} initial={sheet} />}
      sheet={sheet ? "panel" : undefined}
      viewport={viewport}
      zoom={zoom}
    >
      <UseCaseStage
        chosen={chosen}
        entry={entry}
        filtered={viewport === "desktop" || sheet}
        picked={state.picked}
        steps={TOUR_STEPS}
        zoom={zoom}
      />
    </CanvasShell>
  );
}

export const canvasUseCaseScreen = defineScreen({
  ...canvasDesignMetadata,
  relatedDocs: [
    ...canvasDesignMetadata.relatedDocs,
    "docs/protocol/mokly-shell-canvas-stage.md",
  ],
  description:
    "The Example tour as one section on the canvas: one Desktop · Light frame for each step, in a row from left to right, each named by its number and title, which opens its screen, above its description. On a phone, the frame picker shows one step at a time.",
  ...artboardStates(
    {
      state: "tour",
      title: "Use case",
      desktop: <UseCase state={STATES.tour} viewport="desktop" />,
      mobile: <UseCase state={STATES.tour} viewport="mobile" />,
    },
    [
      {
        colorSchemes: canvasDesignMetadata.colorSchemes,
        description:
          "The Frames filter chooses Mobile, which turns Desktop off, so each step shows its Mobile · Light frame and the section fits again. On a phone, the Inspect sheet is open at the Frames filter.",
        desktop: <UseCase state={STATES.mobile} viewport="desktop" />,
        mobile: <UseCase state={STATES.mobile} viewport="mobile" />,
        slug: "mobile",
        title: "Mobile frames",
      },
      {
        colorSchemes: canvasDesignMetadata.colorSchemes,
        description:
          "The Frames filter chooses Dark, which turns Light off, so each step shows its Dark frame. Both step screens have a dark view, so no step keeps its Light view.",
        desktop: <UseCase state={STATES.dark} viewport="desktop" />,
        mobile: <UseCase state={STATES.dark} viewport="mobile" />,
        slug: "dark",
        title: "Dark frames",
      },
      {
        colorSchemes: canvasDesignMetadata.colorSchemes,
        description:
          "On a phone, the frame picker picks 2 · Details, so the canvas shows the second step's frame alone. A desktop keeps both steps in the section until the window narrows into the compact layout.",
        desktop: <UseCase state={STATES.secondStep} viewport="desktop" />,
        mobile: <UseCase state={STATES.secondStep} viewport="mobile" />,
        slug: "second-step",
        title: "Second step",
      },
    ],
  ),
  slug: "tour",
  rationale:
    "A use case reads like a prototype flow in a design file: the steps stand in order at one zoom, one frame each, and each step opens its own screen, which keeps the step's comparison, so the use case offers no compare mode.",
  title: "Use case",
});
