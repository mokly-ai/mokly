import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { COMPARISON_VIEW } from "../parts/changes_sketches.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import { AFFECTED_ENTRIES, actionBranchAll } from "./parts/branch.js";
import { AffectedChanges, affectedFrame } from "./parts/changes.js";
import { EXPLORER_PAGES as E } from "./parts/destinations.js";
import { explorerChangesMetadata, explorerState } from "./parts/metadata.js";
import {
  affectedFrames,
  screenFramePicks,
  type AffectedScreen,
} from "./parts/sketches.js";

/** The artboard of each affected screen. */
const AFFECTED_PAGES = {
  welcome: E.explorerAffected,
  details: E.explorerAffectedDetails,
} as const satisfies Record<AffectedScreen, string>;

/**
 * A screen that the changed Action affects, opened from the Action's Usage:
 * unmodified and outside Changes, so the catalogue in All selects it, yet
 * its Changes tab compares it in Side by side, Desktop · Light on a desktop
 * and Mobile · Light on a phone, where only its Actions differ. A comparison
 * cannot be highlighted. On a phone, the compared frame's pair.
 */
function Affected({
  screen,
  viewport,
}: {
  screen: AffectedScreen;
  viewport: ArtboardViewport;
}) {
  const entry = AFFECTED_ENTRIES[screen];
  const design = AFFECTED_PAGES[screen];
  const frame = affectedFrame(viewport);
  return (
    <CanvasShell
      catalogue={actionBranchAll(screen)}
      compactZoom={FITS.phoneSide}
      design={design}
      entry={entry}
      panel={<AffectedChanges design={design} frame={frame} />}
      tab="changes"
      viewport={viewport}
      zoom={FITS.sideBySide}
    >
      <CanvasStage
        compare="side-by-side"
        entry={entry}
        frames={affectedFrames(screen)}
        pickable={screenFramePicks()}
        picked={frame}
        view={COMPARISON_VIEW}
        zoom={FITS.sideBySide}
      />
    </CanvasShell>
  );
}

export const canvasExplorerAffectedScreen = defineScreen({
  ...explorerChangesMetadata,
  description:
    "A screen that a changed component affects: Welcome, opened from the Action's Affected screens, compares in Side by side on its Changes tab, with no stepper, while it stays unmodified and outside Changes. Its comparison details name the changed Action.",
  ...artboardStates(
    {
      state: "welcome",
      title: "Welcome",
      desktop: <Affected screen="welcome" viewport="desktop" />,
      mobile: <Affected screen="welcome" viewport="mobile" />,
    },
    [
      explorerState(
        "details",
        "Details",
        "Details, the other screen that renders the changed Action, opened from the same list in Side by side.",
        (viewport) => <Affected screen="details" viewport={viewport} />,
      ),
    ],
  ),
  slug: "affected",
  rationale:
    "A screen that only a changed component affects keeps no Changes row of its own, so it has no place among the branch's changes, yet its comparison is eligible and lives in its Changes tab, which ends with the sentence that says why it renders differently.",
  title: "Affected screen",
});
