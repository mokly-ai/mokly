import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { frameOf } from "../parts/set_sketches.js";
import { VariantSetArtboard } from "../parts/set_stage.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import {
  REMOVAL_CHANGES,
  REMOVED_COMPACT,
  REMOVED_FIT,
} from "./parts/branch.js";
import { COMPACT_FRAME, RemovedChanges } from "./parts/changes.js";
import { EXPLORER_PAGES as E } from "./parts/destinations.js";
import { RemovedInspect } from "./parts/inspect_states.js";
import { explorerChangesMetadata, explorerState } from "./parts/metadata.js";
import {
  PAIR_PHONE_FIT,
  compactFrames,
  removedSetFrames,
  removedSideFrames,
} from "./parts/sketches.js";

/**
 * The removed Compact on the removal branch, opened from the Changes filter
 * on Inspect: its parent's variant set with the Compact row after the
 * current variants, whose frames hold the missing current version, and its
 * Light frame selected; on a phone, that frame alone.
 */
function RemovedOnInspect({ viewport }: { viewport: ArtboardViewport }) {
  const frames = removedSetFrames();
  return (
    <VariantSetArtboard
      catalogue={REMOVAL_CHANGES}
      design={E.explorerRemoved}
      entry={REMOVED_COMPACT}
      frames={frames}
      panel={<RemovedInspect />}
      selection={{ frame: frameOf(frames, "compact-light") }}
      viewport={viewport}
      zoom={REMOVED_FIT}
    />
  );
}

/**
 * Compact's comparison on its Changes tab: its missing current side makes
 * the comparison fall back to Side by side, which shows Compact · Light's
 * version before beside the explicit message of its missing current
 * version, at full size. Only Compact's frames compare, so the stage holds
 * their pairs, and the compact frame picker picks the other pair in place.
 * In Changes the canvas draws no selection. On a phone, the compared pair.
 */
function RemovedComparison({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <CanvasShell
      catalogue={REMOVAL_CHANGES}
      compactZoom={PAIR_PHONE_FIT}
      design={E.explorerRemovedChanges}
      entry={REMOVED_COMPACT}
      panel={<RemovedChanges />}
      tab="changes"
      viewport={viewport}
      zoom={FITS.action}
    >
      <CanvasStage
        compare="side-by-side"
        entry={REMOVED_COMPACT}
        frames={removedSideFrames()}
        pickable={compactFrames()}
        picked={COMPACT_FRAME}
        zoom={FITS.action}
      />
    </CanvasShell>
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
      desktop: <RemovedOnInspect viewport="desktop" />,
      mobile: <RemovedOnInspect viewport="mobile" />,
    },
    [
      explorerState(
        "changes",
        "Side by side",
        "Compact's comparison: a removed component variant stays eligible for comparison with a missing current side, so the rail names both versions, every compare mode is offered, and the comparison falls back to Side by side. Compact's version before stands beside the message of its missing current version, and the comparison details say that the branch removed it.",
        (viewport) => <RemovedComparison viewport={viewport} />,
      ),
    ],
  ),
  slug: "removed",
  rationale:
    "A removed variant is its own Removed entry and leaves its parent unmarked, so the set keeps its row in its place. Removing a saved variant changes no consumer's render, so Usage lists the Action's consumers and affects none.",
  title: "Removed variant",
});
