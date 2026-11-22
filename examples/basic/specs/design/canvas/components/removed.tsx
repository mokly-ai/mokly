import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import type { PanelTab } from "../parts/panel.js";
import { frameOf } from "../parts/set_sketches.js";
import { VariantSetArtboard } from "../parts/set_stage.js";

import {
  REMOVAL_CHANGES,
  REMOVED_COMPACT,
  REMOVED_FIT,
} from "./parts/branch.js";
import { RemovedChanges } from "./parts/changes.js";
import { EXPLORER_PAGES as E } from "./parts/destinations.js";
import { RemovedInspect } from "./parts/inspect_states.js";
import { explorerChangesMetadata, explorerState } from "./parts/metadata.js";
import { removedSetFrames } from "./parts/sketches.js";

/**
 * The removed Compact on the removal branch, opened from the Changes filter:
 * its parent's variant set with the Compact row after the current variants,
 * whose frames hold the missing current version. On Inspect, its Light
 * frame is selected; on a phone, that frame alone. On the Changes tab, the
 * canvas draws no selection, and a phone shows the Changes sheet open.
 */
function Removed({
  tab,
  viewport,
}: {
  tab: PanelTab;
  viewport: ArtboardViewport;
}) {
  const frames = removedSetFrames();
  const changes = tab === "changes";
  return (
    <VariantSetArtboard
      catalogue={REMOVAL_CHANGES}
      compare={changes ? "current" : undefined}
      design={changes ? E.explorerRemovedChanges : E.explorerRemoved}
      entry={REMOVED_COMPACT}
      frames={frames}
      panel={changes ? <RemovedChanges /> : <RemovedInspect />}
      selection={
        changes ? undefined : { frame: frameOf(frames, "compact-light") }
      }
      sheet={changes ? "panel" : undefined}
      tab={tab}
      viewport={viewport}
      zoom={REMOVED_FIT}
    />
  );
}

export const canvasExplorerRemovedScreen = defineScreen({
  ...explorerChangesMetadata,
  description:
    "A removed saved variant: the Action's Compact, which the branch removed, stays on its parent's variant set after the current variants. It has no current version, so each of its frames says so, and Props keeps its saved props read-only.",
  ...artboardStates(
    {
      state: "inspect",
      title: "Removed variant",
      desktop: <Removed tab="inspect" viewport="desktop" />,
      mobile: <Removed tab="inspect" viewport="mobile" />,
    },
    [
      explorerState(
        "changes",
        "Changes",
        "Compact's Changes tab: a removed component variant stays eligible for comparison, so the rail names both versions and every compare mode is offered, while the comparison details say that the branch removed it.",
        (viewport) => <Removed tab="changes" viewport={viewport} />,
      ),
    ],
  ),
  slug: "removed",
  rationale:
    "A removed variant is its own Removed entry and leaves its parent unmarked, so the set keeps its row in its place. Removing a saved variant changes no consumer's render, so Usage lists the Action's consumers and affects none.",
  title: "Removed variant",
});
