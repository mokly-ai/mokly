import type { ReactNode } from "react";

import type { ArtboardViewport } from "../../parts/artboards.js";
import type { DepictedView } from "../../parts/depicted_view.js";

import type { CatalogueView } from "./catalogue.js";
import type { CanvasEntry } from "./entries.js";
import type { CanvasFrameSpec } from "./frames.js";
import type { CanvasInstance } from "./instances.js";
import { SelectionPill, selectionOverlays } from "./selection.js";
import { CanvasShell } from "./shell.js";
import { FITS } from "./sketches.js";
import { CanvasStage } from "./stage.js";

/**
 * A screen with one of its instances selected on its phone frame: the
 * canvas, zoomed onto that frame, draws the selection and lights the frame's
 * label, and the Inspect that the caller gives opens at the Selection
 * section. On a phone, the one frame draws the selection, and the pill above
 * the dock names it.
 */
export function ScreenSelection({
  catalogue,
  entry,
  frames,
  instance,
  panel,
  view,
  viewport,
}: {
  catalogue: CatalogueView;
  entry: CanvasEntry;
  frames: readonly CanvasFrameSpec[];
  instance: CanvasInstance;
  /** Inspect with the instance selected. */
  panel: ReactNode;
  view: DepictedView;
  viewport: ArtboardViewport;
}) {
  return (
    <CanvasShell
      catalogue={catalogue}
      compactZoom={FITS.phone}
      design={instance.page}
      entry={entry}
      panel={panel}
      pill={<SelectionPill instance={instance} />}
      viewport={viewport}
      zoom={100}
    >
      <CanvasStage
        entry={entry}
        frames={frames}
        overlays={selectionOverlays(instance)}
        pan="end"
        picked={instance.frame.id}
        selected={instance.frame.id}
        view={view}
        zoom={100}
      />
    </CanvasShell>
  );
}
