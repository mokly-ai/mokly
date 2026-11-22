import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { actionFrames, frameOf } from "../parts/set_sketches.js";
import { VariantSetArtboard } from "../parts/set_stage.js";
import { FITS } from "../parts/sketches.js";

import {
  CHANGED_DEFAULT,
  EXPLORER_KEYS,
  actionBranchChanges,
} from "./parts/branch.js";
import { EXPLORER_PAGES as E } from "./parts/destinations.js";
import { DefaultInspect } from "./parts/inspect_default.js";
import { explorerMetadata, explorerState } from "./parts/metadata.js";

/**
 * The Action's saved variant Default chosen on the Action branch, in
 * Current: its Light frame is selected, Props edits Default, and Usage lists
 * the Action's consumers and the screens that its change affects, or waits
 * for the parent's detail that holds them. On a phone, the selected frame
 * with the Inspect sheet open at its expanded height.
 */
function DefaultUsage({
  loading,
  viewport,
}: {
  loading: boolean;
  viewport: ArtboardViewport;
}) {
  const frames = actionFrames();
  const design = loading ? E.explorerUsageLoading : E.explorerUsage;
  return (
    <VariantSetArtboard
      catalogue={actionBranchChanges(EXPLORER_KEYS.default)}
      design={design}
      entry={CHANGED_DEFAULT}
      expanded
      frames={frames}
      panel={
        <DefaultInspect design={design} state={loading ? "loading" : "usage"} />
      }
      selection={{ frame: frameOf(frames, "default-light") }}
      sheet="panel"
      viewport={viewport}
      zoom={FITS.action}
    />
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
      desktop: <DefaultUsage loading={false} viewport="desktop" />,
      mobile: <DefaultUsage loading={false} viewport="mobile" />,
    },
    [
      explorerState(
        "loading",
        "Loading usage",
        "Default's own detail has arrived, so Props edits it, while the parent's detail, which holds the usage, still loads: Usage reads Loading usage… with no count, list, or empty state.",
        (viewport) => <DefaultUsage loading viewport={viewport} />,
      ),
    ],
  ),
  slug: "usage",
  rationale:
    "A component changed alone: Welcome and Details render it, so its change affects them, yet they stay out of Changes. A saved variant shows its parent's lists, which arrive with the parent's detail, so Usage never shows an empty state before then.",
  title: "Component usage",
});
