import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import type { CatalogueView } from "../parts/catalogue.js";
import { CANVAS_PAGES as C } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import type { FrameScheme } from "../parts/frames.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import type { PanelTab } from "../parts/panel.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";

import { UseCaseChanges } from "./parts/changes.js";
import { FLOW_PAGES as F, type FlowDestination } from "./parts/destinations.js";
import { UseCaseInspect } from "./parts/inspect.js";
import { UseCaseStage } from "./parts/stage.js";
import { TOUR_FITS, TOUR_STEPS, type StepFrames } from "./parts/steps.js";

/**
 * A state of the use case: the viewport that the Frames filter chooses on a
 * desktop, where a phone chooses Mobile, the scheme that it chooses on both,
 * the step that a phone's frame picker shows, whether a phone opens the
 * panel sheet, and the right panel's tab.
 */
interface UseCaseState {
  design: FlowDestination;
  viewport: ArtboardViewport;
  scheme: FrameScheme;
  picked?: number | undefined;
  sheet?: boolean | undefined;
  /** The right panel's tab; Inspect by default. */
  tab?: PanelTab | undefined;
}

const STATES = {
  tour: { design: F.useCase, viewport: "desktop", scheme: "light" },
  changes: {
    design: F.useCaseChanges,
    viewport: "desktop",
    scheme: "light",
    sheet: true,
    tab: "changes",
  },
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
 * The catalogue on each tab: All on Inspect, and the Changes filter on the
 * Changes tab, where the rows of Welcome and Details keep the tab.
 */
const CATALOGUES = {
  inspect: { filter: "all", activeKey: "example/tour" },
  changes: {
    filter: "changes",
    activeKey: "example/tour",
    targets: { welcome: C.changesCurrent, details: C.addedChanges },
  },
} as const satisfies Record<PanelTab, CatalogueView>;

/**
 * The Example tour as one section of its two steps: on Inspect, selected
 * from All, or on the Changes tab, selected from the Changes filter, which
 * lists the tour because the branch changed both step screens. On a desktop,
 * the zoom pill fits the section. On a phone, the compact layout shows the
 * picked step's Mobile frame, and the dock holds Catalogue, the current tab
 * and Fit. The Changes tab holds no Frames filter, so there each step holds
 * only the frame that the state chooses: Desktop · Light, or a phone's
 * Mobile · Light.
 */
function UseCase({
  state,
  viewport,
}: {
  state: UseCaseState;
  viewport: ArtboardViewport;
}) {
  const entry = CANVAS_ENTRIES.tour;
  const tab = state.tab ?? "inspect";
  const changes = tab === "changes";
  const sheet = viewport === "mobile" && state.sheet === true;
  const chosen: StepFrames = {
    viewport: viewport === "mobile" ? viewport : state.viewport,
    scheme: state.scheme,
  };
  const zoom = TOUR_FITS[state.viewport];
  return (
    <CanvasShell
      catalogue={CATALOGUES[tab]}
      compactZoom={FITS.phone}
      design={state.design}
      entry={entry}
      panel={
        changes ? (
          <UseCaseChanges />
        ) : (
          <UseCaseInspect chosen={chosen} initial={sheet} />
        )
      }
      sheet={sheet ? "panel" : undefined}
      tab={tab}
      viewport={viewport}
      zoom={zoom}
    >
      <UseCaseStage
        chosen={chosen}
        entry={entry}
        filtered={!changes && (viewport === "desktop" || sheet)}
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
    "docs/protocol/mokly-changes-controls.md",
  ],
  description:
    "The Example tour as one section on the canvas: one Desktop · Light frame for each step, in a row from left to right, each named by its number and title, which opens its screen, above its description. The branch changed both step screens, so the tour reads Changed. On a phone, the frame picker shows one step at a time.",
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
          "The Changes tab of the use case: its place among the branch's changes, Compared, and the comparison details, which link each changed step to its screen's Changes tab. A use case offers no compare mode. On a phone, the Changes sheet is open.",
        desktop: <UseCase state={STATES.changes} viewport="desktop" />,
        mobile: <UseCase state={STATES.changes} viewport="mobile" />,
        slug: "changes",
        title: "Changes",
      },
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
