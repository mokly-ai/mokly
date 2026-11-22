import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { EmptyState, LoadingState } from "../../parts/stage_content.js";
import { CANVAS_PAGES as C } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS, welcomeFrames } from "../parts/sketches.js";

import { StageStateInspect } from "./parts/inspect.js";
import { entryLoadingMetadata } from "./parts/metadata.js";
import { StageState } from "./parts/stage_state.js";

/** The state of Welcome's stage: its detail loads, or it failed. */
type EntryState = "failed" | "loading";

/**
 * Welcome, selected from All, while its stage waits for the entry's detail
 * or after that detail failed. The catalogue and Inspect stay in place, and
 * the stage holds the shipped state instead of the frames. An entry is
 * selected, so the zoom pill shows at Welcome's fitted zoom, and its Fit
 * refits this stage. On a phone, the compact entry bar names Welcome and
 * picks its frame, and the dock holds Catalogue, Inspect, and Fit.
 */
function EntryStage({
  state,
  viewport,
}: {
  state: EntryState;
  viewport: ArtboardViewport;
}) {
  const entry = CANVAS_ENTRIES.welcome;
  const failed = state === "failed";
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "welcome" }}
      compactZoom={FITS.phone}
      design={failed ? C.loadingEntryFailed : C.loadingEntry}
      entry={entry}
      panel={<StageStateInspect state={state} />}
      viewport={viewport}
      zoom={FITS.welcome}
    >
      <StageState selected={{ entry, frames: welcomeFrames() }} state={state}>
        {failed ? (
          <EmptyState
            body="The catalogue is still available while you try again."
            linkLabel="Try again"
            title="This screen could not be shown"
            to={C.loadingEntry}
          />
        ) : (
          <LoadingState status="Loading preview…" />
        )}
      </StageState>
    </CanvasShell>
  );
}

export const canvasEntryLoadingScreen = defineScreen({
  ...entryLoadingMetadata,
  description:
    "The canvas while the selected entry's detail loads: the catalogue, Inspect, and the zoom controls stay, and the stage holds one status line in place of the frames. The same stage covers a replaced catalogue: after another deployment answers, it keeps loading until the new catalogue arrives.",
  ...artboardStates(
    {
      state: "loading",
      title: "Loading",
      desktop: <EntryStage state="loading" viewport="desktop" />,
      mobile: <EntryStage state="loading" viewport="mobile" />,
    },
    [
      {
        description:
          "The entry's detail could not be loaded. The catalogue, Inspect, and the zoom controls stay in place, and Try again loads the detail again, which shows the loading stage.",
        desktop: <EntryStage state="failed" viewport="desktop" />,
        mobile: <EntryStage state="failed" viewport="mobile" />,
        rationale:
          "Recovery states are reached by readers who are already lost, so they keep the chosen appearance, the catalogue, and the right panel instead of resetting to a bare page.",
        slug: "failed",
        title: "Entry unavailable",
      },
    ],
  ),
  slug: "entry",
  rationale:
    "The catalogue index already names the entry and its views, so the catalogue row, Inspect's head, the compact entry bar with its frame picker, and the zoom controls show at once; only the frames, Props, Usage, and Components wait for the entry's detail.",
  title: "Entry loading",
});
