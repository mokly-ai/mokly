import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { DetailsStage } from "../loading/parts/stage_state.js";
import { actionSetFrames, frameOf } from "../parts/set_sketches.js";
import { VariantSetArtboard } from "../parts/set_stage.js";
import { CanvasShell } from "../parts/shell.js";
import { SET_FITS } from "../parts/sketches.js";

import {
  CHANGED_DEFAULT,
  EXPLORER_KEYS,
  actionBranchChanges,
} from "./parts/branch.js";
import { EXPLORER_PAGES as E } from "./parts/destinations.js";
import {
  DefaultInspect,
  PENDING_DETAILS,
  type DefaultInspectState,
} from "./parts/inspect_default.js";
import { explorerMetadata, explorerState } from "./parts/metadata.js";

/** A state of Default's usage: listed, loading, or failed to load. */
type UsageState = Exclude<DefaultInspectState, "comparison">;

/** The artboard that shows each state of Default's usage. */
const USAGE_PAGES = {
  usage: E.explorerUsage,
  loading: E.explorerUsageLoading,
  failed: E.explorerUsageFailed,
} as const satisfies Record<UsageState, string>;

/**
 * The Action's saved variant Default chosen on the Action branch, in
 * Current: its Light frame is selected, Props edits Default, and Usage lists
 * the Action's consumers and the screens that its change affects. A current
 * variant waits for its own detail and its parent's, which holds the usage:
 * while the parent's detail loads, or after that load failed, the stage
 * holds the shipped state in place of the frames, with no zoom controls,
 * because the canvas holds no section, and Props and Usage wait or say that
 * they could not be loaded. On a phone, the selected frame with the Inspect
 * sheet open at its expanded height; while the details are pending, the
 * sheet opens at its first height, so the stage's state shows above it.
 */
function DefaultUsage({
  state,
  viewport,
}: {
  state: UsageState;
  viewport: ArtboardViewport;
}) {
  const frames = actionSetFrames();
  const frame = frameOf(frames, "default-light");
  const design = USAGE_PAGES[state];
  const catalogue = actionBranchChanges(EXPLORER_KEYS.default);
  const panel = <DefaultInspect design={design} state={state} />;
  return state === "usage" ? (
    <VariantSetArtboard
      catalogue={catalogue}
      design={design}
      entry={CHANGED_DEFAULT}
      expanded
      fit={SET_FITS.action}
      frames={frames}
      panel={panel}
      selection={{ frame }}
      sheet="panel"
      viewport={viewport}
    />
  ) : (
    <CanvasShell
      catalogue={catalogue}
      design={design}
      entry={CHANGED_DEFAULT}
      panel={panel}
      sheet="panel"
      viewport={viewport}
    >
      <DetailsStage
        details={PENDING_DETAILS[state]}
        entry={CHANGED_DEFAULT}
        frames={frames}
        picked={frame.id}
      />
    </CanvasShell>
  );
}

export const canvasExplorerUsageScreen = defineScreen({
  ...explorerMetadata,
  description:
    "A changed component's usage: the Action's Default variant chosen in Current, with Usage listing the screens and the component that use the Action, and the screens that its change affects, each opening its own comparison.",
  ...artboardStates(
    {
      state: "affected",
      title: "Affected screens",
      desktop: <DefaultUsage state="usage" viewport="desktop" />,
      mobile: <DefaultUsage state="usage" viewport="mobile" />,
    },
    [
      explorerState(
        "loading",
        "Loading usage",
        "Default's own detail has arrived, while the parent's detail, which holds the usage, still loads. A current variant waits for both, so the stage holds Loading preview… in place of the frames, Props shows Loading props… with no fields, and Usage reads Loading usage… with no count, list, or empty state.",
        (viewport) => <DefaultUsage state="loading" viewport={viewport} />,
      ),
      explorerState(
        "failed",
        "Usage failed to load",
        "The parent's detail, which holds the usage, could not be loaded, so the variant page is unavailable: the stage says that the component could not be shown, Props reads Props couldn’t be loaded., and Usage reads Usage couldn’t be loaded. with no count, list, or empty state. Each Try again loads the details again, which opens Loading usage.",
        (viewport) => <DefaultUsage state="failed" viewport={viewport} />,
      ),
    ],
  ),
  slug: "usage",
  rationale:
    "A component changed alone: Welcome and Details render it, so its change affects them, yet they stay out of Changes. A saved variant shows its parent's lists, which arrive with the parent's detail, so Usage never shows an empty state before then, and the stage and Props wait for the same detail.",
  title: "Component usage",
});
