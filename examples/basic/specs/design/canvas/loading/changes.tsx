import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import type { CatalogueView } from "../parts/catalogue.js";
import {
  CANVAS_PAGES as C,
  type CanvasDestination,
} from "../parts/destinations.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS, WELCOME_VIEW, welcomeFrames } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import { UnclassifiedWelcomeInspect } from "./parts/inspect.js";
import { changesStatusMetadata } from "./parts/metadata.js";
import {
  UNREVISED_WELCOME_VIEW,
  WELCOME_UNCLASSIFIED,
  unrevisedWelcomeFrames,
} from "./parts/welcome.js";

/**
 * A state of the catalogue's Changes filter before it lists any change, by
 * the slug of its saved state; the screen's own state checks for changes.
 */
type ChangesState =
  "checking" | "empty" | "preparing" | "unavailable" | "without-changes";

/** The Changes filter with Welcome selected, in one availability state. */
function changesFilter(
  changesStatus: CatalogueView["changesStatus"],
): CatalogueView {
  return { filter: "changes", activeKey: "welcome", changesStatus };
}

/** The artboard and the catalogue of each state. */
const STATES = {
  checking: { design: C.loadingChanges, catalogue: changesFilter("pending") },
  preparing: {
    design: C.loadingChangesPreparing,
    catalogue: changesFilter("preparing"),
  },
  unavailable: {
    design: C.loadingChangesUnavailable,
    catalogue: changesFilter("unavailable"),
  },
  empty: {
    design: C.loadingChangesEmpty,
    catalogue: { ...changesFilter("ready"), changedCount: 0, rows: [] },
  },
  "without-changes": {
    design: C.loadingChangesWithout,
    catalogue: { filter: "all", activeKey: "welcome", showChanges: false },
  },
} as const satisfies Record<
  ChangesState,
  { design: CanvasDestination; catalogue: CatalogueView }
>;

/**
 * Welcome on the canvas while the catalogue holds no comparison result: its
 * four frames at one zoom, and the right panel with the Inspect tab alone.
 * A branch without changes shows the Welcome of its branch point. On a
 * phone, the catalogue sheet is open over Welcome's frame.
 */
function ChangesAvailability({
  state,
  viewport,
}: {
  state: ChangesState;
  viewport: ArtboardViewport;
}) {
  const { catalogue, design } = STATES[state];
  const empty = state === "empty";
  return (
    <CanvasShell
      catalogue={catalogue}
      compactZoom={FITS.phone}
      design={design}
      entry={WELCOME_UNCLASSIFIED}
      panel={<UnclassifiedWelcomeInspect />}
      sheet="catalogue"
      viewport={viewport}
      zoom={FITS.welcome}
    >
      <CanvasStage
        entry={WELCOME_UNCLASSIFIED}
        frames={empty ? unrevisedWelcomeFrames() : welcomeFrames()}
        view={empty ? UNREVISED_WELCOME_VIEW : WELCOME_VIEW}
        zoom={FITS.welcome}
      />
    </CanvasShell>
  );
}

/** A saved state of the Changes filter, at its slug, with its artboards. */
function variant(
  state: Exclude<ChangesState, "checking">,
  title: string,
  description: string,
  rationale?: string,
) {
  return {
    description,
    desktop: <ChangesAvailability state={state} viewport="desktop" />,
    mobile: <ChangesAvailability state={state} viewport="mobile" />,
    ...(rationale === undefined ? {} : { rationale }),
    slug: state,
    title,
  };
}

export const canvasChangesStatusScreen = defineScreen({
  ...changesStatusMetadata,
  description:
    "The Changes filter while the comparison runs: a spinner holds the count's place, and the filter says that it checks for changes in place of rows. Welcome stays on the canvas, and All stays selectable. On a phone, the catalogue sheet is open.",
  ...artboardStates(
    {
      state: "checking",
      title: "Checking for changes",
      desktop: <ChangesAvailability state="checking" viewport="desktop" />,
      mobile: <ChangesAvailability state="checking" viewport="mobile" />,
    },
    [
      variant(
        "preparing",
        "Preparing comparison",
        "The Changes filter before the comparison exists, while the sources of the branch point are prepared. A spinner holds the count's place, and the message asks the reader to wait while All stays available.",
        "Preparing is the one message with a second line, because it is the one state that asks the reader to wait.",
      ),
      variant(
        "unavailable",
        "Changes unavailable",
        "The comparison could not be made: a dash holds the count's place, and the filter says that Changes is unavailable while All stays available.",
        "A failed preparation and a failed check share the one unavailable message, which never names a command, a path, or a reason.",
      ),
      variant(
        "empty",
        "No changes",
        "A branch without changes: the count reads 0, the filter says that it found none, and the selected Welcome, the version of the branch point, stays on the canvas.",
      ),
      variant(
        "without-changes",
        "Without Changes",
        "A catalogue built without comparison data: the catalogue has no All and Changes filter and names no base, and the right panel has no Changes tab.",
        "Comparison data is optional in a static build, so the catalogue keeps its filter-free layout instead of a Changes filter that could never fill.",
      ),
    ],
  ),
  slug: "changes",
  rationale:
    "Entries carry no change status until the comparison is ready, so Welcome names no status and its right panel has the Inspect tab alone. The filter, the count slot, and the tree keep their places in every state, so nothing moves when the result arrives.",
  title: "Changes availability",
});
