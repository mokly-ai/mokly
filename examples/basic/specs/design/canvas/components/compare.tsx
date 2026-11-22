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
import {
  DEFAULT_MODES,
  DefaultChanges,
  type DefaultMode,
} from "./parts/changes.js";
import { EXPLORER_PAGES as E } from "./parts/destinations.js";
import { DefaultInspect } from "./parts/inspect_default.js";
import { explorerChangesMetadata, explorerState } from "./parts/metadata.js";
import { actionCompareFrames } from "./parts/sketches.js";

/**
 * The Action's saved variant Default on the Changes tab of the Action
 * branch: the Action's variant set in the shown mode, which Overlay and
 * Difference apply to every frame, and the catalogue in the Changes filter
 * with Default selected. In Changes the canvas draws no selection. On a
 * phone, Current shows the Changes sheet open, and a comparison the whole
 * set.
 */
function DefaultCompare({
  mode,
  viewport,
}: {
  mode: DefaultMode;
  viewport: ArtboardViewport;
}) {
  return (
    <VariantSetArtboard
      catalogue={actionBranchChanges(EXPLORER_KEYS.default)}
      compare={mode}
      design={DEFAULT_MODES[mode]}
      entry={CHANGED_DEFAULT}
      frames={mode === "current" ? actionFrames() : actionCompareFrames(mode)}
      panel={<DefaultChanges mode={mode} />}
      sheet={mode === "current" ? "panel" : undefined}
      tab="changes"
      viewport={viewport}
      zoom={FITS.action}
    />
  );
}

/**
 * Default on Inspect while Overlay stays on the frames: its Light frame is
 * selected, Props shows its saved props read-only with Switch to Current,
 * and Highlight components waits for Current. On a phone, the selected
 * frame with the Inspect sheet open at Props.
 */
function ComparingProps({ viewport }: { viewport: ArtboardViewport }) {
  const frames = actionCompareFrames("overlay");
  return (
    <VariantSetArtboard
      catalogue={actionBranchChanges(EXPLORER_KEYS.default)}
      compare="overlay"
      design={E.explorerCompareProps}
      entry={CHANGED_DEFAULT}
      frames={frames}
      panel={
        <DefaultInspect design={E.explorerCompareProps} state="comparison" />
      }
      selection={{ frame: frameOf(frames, "default-light") }}
      sheet="panel"
      viewport={viewport}
      zoom={FITS.action}
    />
  );
}

export const canvasExplorerCompareScreen = defineScreen({
  ...explorerChangesMetadata,
  description:
    "A changed component compares on its variant set: the Action's Default variant on the Changes tab, where Overlay holds both versions in every frame of the set. The stepper, Compared, the compare modes, and the comparison details with the saved variant follow.",
  ...artboardStates(
    {
      state: "overlay",
      title: "Overlay",
      desktop: <DefaultCompare mode="overlay" viewport="desktop" />,
      mobile: <DefaultCompare mode="overlay" viewport="mobile" />,
    },
    [
      explorerState(
        "current",
        "Current",
        "Default's Changes tab in Current: the set shows its current version, as Inspect does. On a phone, the Changes sheet is open.",
        (viewport) => <DefaultCompare mode="current" viewport={viewport} />,
      ),
      explorerState(
        "difference",
        "Difference",
        "Difference on every frame of the set: what the two versions share turns dark, so only the button's corners and padding stand out.",
        (viewport) => <DefaultCompare mode="difference" viewport={viewport} />,
      ),
      explorerState(
        "props",
        "Read-only props",
        "Inspect while Overlay stays on: Default's Light frame is selected, Props shows its saved props with Switch to Current, and Highlight components says why it waits. On a phone, the Inspect sheet is open at Props.",
        (viewport) => <ComparingProps viewport={viewport} />,
      ),
    ],
  ),
  slug: "compare",
  rationale:
    "On the Action branch the Action's render changed, so the Action and its three saved variants each changed. Every frame of the set compares its own view, and both versions share the frame's size. The compare mode stays while Inspect is shown, so Props stays read-only until Current.",
  title: "Compare a component",
});
