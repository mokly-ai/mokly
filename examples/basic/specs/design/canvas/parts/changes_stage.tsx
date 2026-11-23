import type { ArtboardViewport } from "../../parts/artboards.js";

import { WelcomeChanges } from "./changes.js";
import {
  COMPARISON_VIEW,
  welcomeChangesFrames,
  type CompareFrame,
  type CompareMode,
} from "./changes_sketches.js";
import { CANVAS_PAGES, WELCOME_MODES } from "./destinations.js";
import { CANVAS_ENTRIES } from "./entries.js";
import { CanvasShell } from "./shell.js";
import { FITS, WELCOME_VIEW, welcomeFrames } from "./sketches.js";
import { CanvasStage } from "./stage.js";

/**
 * Welcome on the Changes tab in one compare mode: the catalogue in the
 * Changes filter with Welcome selected, the frames in the mode, and the
 * Changes body. The catalogue's rows keep the Changes tab: Details opens
 * its Changes. Side by side compares Desktop · Light on a desktop and
 * Mobile · Light on a phone, as two frames at a smaller zoom. A comparison
 * cannot be highlighted; Current can, as in Inspect. On a phone, Current
 * shows the Changes sheet open, and every other mode its one frame.
 */
export function WelcomeChangesArtboard({
  mode,
  viewport,
}: {
  mode: CompareMode;
  viewport: ArtboardViewport;
}) {
  const entry = CANVAS_ENTRIES.welcome;
  const design = WELCOME_MODES[mode];
  const side = mode === "side-by-side";
  const frame: CompareFrame =
    side && viewport === "desktop" ? "desktop-light" : "mobile-light";
  const zoom = side ? FITS.sideBySide : FITS.welcome;
  return (
    <CanvasShell
      catalogue={{
        filter: "changes",
        activeKey: "welcome",
        targets: { details: CANVAS_PAGES.addedChanges },
      }}
      compactZoom={side ? FITS.phoneSide : FITS.phone}
      design={design}
      entry={entry}
      panel={<WelcomeChanges frame={side ? frame : undefined} mode={mode} />}
      sheet={mode === "current" ? "panel" : undefined}
      tab="changes"
      viewport={viewport}
      zoom={zoom}
    >
      <CanvasStage
        compare={mode}
        entry={entry}
        frames={welcomeChangesFrames(mode)}
        pickable={side ? welcomeFrames() : undefined}
        picked={frame}
        view={mode === "current" ? WELCOME_VIEW : COMPARISON_VIEW}
        zoom={zoom}
      />
    </CanvasShell>
  );
}
