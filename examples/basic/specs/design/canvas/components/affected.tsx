import type { ReactNode } from "react";

import { defineScreen } from "@mokly/mokly";

import {
  artboardStates,
  type ArtboardViewport,
} from "../../parts/artboards.js";
import type { CatalogueView } from "../parts/catalogue.js";
import {
  COMPARISON_VIEW,
  type CompareFrame,
} from "../parts/changes_sketches.js";
import type { CanvasDestination } from "../parts/destinations.js";
import { CANVAS_ENTRIES, type CanvasEntry } from "../parts/entries.js";
import type { CanvasFrameSpec } from "../parts/frames.js";
import { CanvasShell, type CanvasSheet } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import {
  AFFECTED_ENTRIES,
  DIRECT_CHANGES,
  actionBranchAll,
} from "./parts/branch.js";
import { AffectedChanges, useAffectedFrame } from "./parts/changes.js";
import { EXPLORER_PAGES as E } from "./parts/destinations.js";
import { DirectChanges, directFrames } from "./parts/direct.js";
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
 * A screen on its Changes tab in Side by side, which compares the frame that
 * the artboard shows: Desktop · Light on a desktop, and on a phone the frame
 * that the phone opens on, where the stage shows the compared frame's pair.
 * A comparison cannot be highlighted.
 */
function SideBySideScreen({
  catalogue,
  design,
  entry,
  frame,
  frames,
  panel,
  sheet,
  viewport,
}: {
  catalogue: CatalogueView;
  design: CanvasDestination;
  entry: CanvasEntry;
  frame: CompareFrame;
  frames: readonly CanvasFrameSpec[];
  /** The Changes tab's body. */
  panel: ReactNode;
  /** The sheet that a phone shows open; none by default. */
  sheet?: CanvasSheet | undefined;
  viewport: ArtboardViewport;
}) {
  return (
    <CanvasShell
      catalogue={catalogue}
      compactZoom={FITS.phoneSide}
      design={design}
      entry={entry}
      panel={panel}
      sheet={sheet}
      tab="changes"
      viewport={viewport}
      zoom={FITS.sideBySide}
    >
      <CanvasStage
        compare="side-by-side"
        entry={entry}
        frames={frames}
        pickable={screenFramePicks()}
        picked={frame}
        view={COMPARISON_VIEW}
        zoom={FITS.sideBySide}
      />
    </CanvasShell>
  );
}

/**
 * A screen that the changed Action affects, opened from the Action's Usage:
 * unmodified and outside Changes, so the catalogue in All selects it, yet
 * its Changes tab compares it in Side by side, where only its Actions
 * differ. On a phone, the compared frame's pair.
 */
function Affected({
  screen,
  viewport,
}: {
  screen: AffectedScreen;
  viewport: ArtboardViewport;
}) {
  const design = AFFECTED_PAGES[screen];
  const frame = useAffectedFrame(viewport);
  return (
    <SideBySideScreen
      catalogue={actionBranchAll(screen)}
      design={design}
      entry={AFFECTED_ENTRIES[screen]}
      frame={frame}
      frames={affectedFrames(screen)}
      panel={<AffectedChanges design={design} frame={frame} />}
      viewport={viewport}
    />
  );
}

/**
 * Welcome on the direct-change branch, where it also changed the label that
 * it gives its own Action: the catalogue in the Changes filter keeps
 * Welcome's own row and selects it, and its Changes tab compares it in Side
 * by side, where its own Action differs in its label and every Action in
 * its corners and padding. The panel opens at the comparison details, and a
 * phone shows the Changes sheet open.
 */
function DirectChange({ viewport }: { viewport: ArtboardViewport }) {
  const frame = useAffectedFrame(viewport);
  return (
    <SideBySideScreen
      catalogue={DIRECT_CHANGES}
      design={E.explorerAffectedDirect}
      entry={CANVAS_ENTRIES.welcome}
      frame={frame}
      frames={directFrames()}
      panel={<DirectChanges frame={frame} />}
      sheet="panel"
      viewport={viewport}
    />
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
      {
        ...explorerState(
          "direct",
          "Own prop change",
          "Welcome on a branch where the Action changed and Welcome also changed the label that it gives its own Action, from Continue to View details. Welcome keeps its own Changes row beside the Action and its three saved variants, five in all, and its Changes tab, Change 1 of 5, compares Desktop · Light in Side by side. Its comparison details read its two reasons, name its Action instance in each view with the props Before and Current, and link the changed Action. On a phone, the Changes sheet opens at the comparison details.",
          (viewport) => <DirectChange viewport={viewport} />,
        ),
        rationale:
          "A screen that changes the props that it supplies keeps its own Changes row, also where a changed component that it uses affects it. Its comparison details pair those props in each view, so a reader sees which instance changed and how without comparing the frames.",
      },
    ],
  ),
  slug: "affected",
  rationale:
    "A screen that only a changed component affects keeps no Changes row of its own, so it has no place among the branch's changes, yet its comparison is eligible and lives in its Changes tab, which ends with the sentence that says why it renders differently.",
  title: "Affected screen",
});
