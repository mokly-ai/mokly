import type { Viewport } from "@mokly/mokly";
import { readingSize, sectionExtent } from "@mokly/ui/canvas-section";
import { fitView } from "@mokly/ui/canvas-stage";
import type { CanvasRect, CanvasView } from "@mokly/ui/canvas-stage";

import { frameSizes } from "./published-frames";
import type { ScreenFrame } from "./published-frames";

/** The top bar above the canvas. */
const barHeight = 48;

/** The catalogue column beside a desktop canvas, as `PublishedViewer` sizes it. */
const catalogueWidth = 248;

/**
 * The room that the right panel takes at a desktop canvas's end: its 312px,
 * its 8px margin and an 8px gap, as the Canvas layout's end inset leaves it.
 */
const panelRoom = 328;

/** The zoom pill's room at a desktop stage's bottom: 12px and the 36px pill. */
const pillRoom = 48;

/**
 * The compact layout's entry bar over the canvas's top, and the dock's room
 * at its bottom, as the Canvas layout's insets leave them.
 */
const entryBarHeight = 52;
const dockRoom = 76;

/**
 * The stage of each drawing's canvas, where Fit places the section, in a
 * document of Mokly's canvas frame of its viewport, which has the size of
 * the drawn frame of that viewport: the canvas less the panels, the bars and
 * the floating controls around the frames.
 */
const stages: Readonly<Record<Viewport, CanvasRect>> = {
  desktop: {
    left: 0,
    top: 0,
    width: frameSizes.desktop.width - catalogueWidth - panelRoom,
    height: frameSizes.desktop.height - barHeight - pillRoom,
  },
  mobile: {
    left: 0,
    top: entryBarHeight,
    width: frameSizes.mobile.width,
    height: frameSizes.mobile.height - barHeight - entryBarHeight - dockRoom,
  },
};

/**
 * The view that the drawing's canvas keeps, because a static document cannot
 * measure its stage: the view that the package's Fit gives the section of
 * `frames` on the stage of its viewport's document. A larger document keeps
 * the same view, with the section at the stage's start.
 */
export function canvasView(
  viewport: Viewport,
  frames: readonly ScreenFrame[],
): CanvasView {
  const compact = viewport === "mobile";
  const stage = stages[viewport];
  const cells = frames.map(({ column, row, viewport: size }) => ({
    column,
    row,
    ...frameSizes[size],
  }));
  return fitView(
    sectionExtent("screen", cells, readingSize(stage, compact), compact),
    stage,
    compact ? "start" : "centre",
  );
}
