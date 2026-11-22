/**
 * The lengths of a section on the canvas: its padding, the gaps between its
 * frames and the size of a reading frame. The section applies them as inline
 * styles and the canvas computes Fit from the same values, so the drawing
 * and the arithmetic cannot drift apart.
 */

import {
  FIT_MARGIN,
  type CanvasExtent,
  type CanvasTrack,
} from "../canvas-stage/canvas-view.js";

/** What a section holds: a screen's frames, a variant set, or a reading frame. */
export type CanvasSectionKind = "component" | "document" | "screen";

/** A frame's nominal size in CSS pixels. */
export interface CanvasSize {
  height: number;
  width: number;
}

/** A frame's cell in the section's grid, from 0, and its nominal size. */
export interface CanvasCell {
  column: number;
  /** A reading frame has no size of its own: it takes the reading size. */
  height?: number | undefined;
  row: number;
  width?: number | undefined;
}

/**
 * The section's padding: the head stands in the top padding, and each
 * frame's label in the padding or the gap above the frame.
 */
export const SECTION_PADDING = {
  bottom: 22,
  left: 22,
  right: 22,
  top: 64,
} as const;

/** The gaps between the columns and the rows of each kind of section. */
export const SECTION_GAPS: Readonly<
  Record<CanvasSectionKind, { column: number; row: number }>
> = {
  component: { column: 40, row: 64 },
  document: { column: 0, row: 0 },
  screen: { column: 44, row: 48 },
};

/** The widest reading frame, a comfortable measure for a document. */
export const READING_MAX_WIDTH = 760;

/** The smallest reading frame, so a tiny stage still shows some document. */
const READING_MIN = { height: 160, width: 240 } as const;

/**
 * The nominal size of a reading frame on a stage: the stage's room less
 * Fit's margins and the section's padding, up to the widest reading frame,
 * so a fitted reading frame shows its document at 100%.
 */
export function readingSize(stage: CanvasSize): CanvasSize {
  const width =
    stage.width - 2 * FIT_MARGIN - SECTION_PADDING.left - SECTION_PADDING.right;
  const height =
    stage.height -
    2 * FIT_MARGIN -
    SECTION_PADDING.top -
    SECTION_PADDING.bottom;
  return {
    height: Math.max(READING_MIN.height, Math.floor(height)),
    width: Math.min(
      READING_MAX_WIDTH,
      Math.max(READING_MIN.width, Math.floor(width)),
    ),
  };
}

/** The largest value at each index, from 0 to the largest index. */
function trackSizes(
  cells: readonly { index: number; size: number }[],
): number[] {
  const sizes: number[] = [];
  for (const { index, size } of cells)
    sizes[index] = Math.max(sizes[index] ?? 0, size);
  return Array.from(sizes, (size) => size ?? 0);
}

/** One axis: the padding, the frames' lengths and the gaps between them. */
function axis(
  start: number,
  sizes: readonly number[],
  gap: number,
  end: number,
): CanvasTrack[] {
  const tracks: CanvasTrack[] = [{ fixed: start }];
  sizes.forEach((size, index) => {
    if (index > 0) tracks.push({ fixed: gap });
    tracks.push({ scaled: size });
  });
  tracks.push({ fixed: end });
  return tracks;
}

/**
 * A section's tracks: each column as wide as its widest frame and each row
 * as tall as its tallest frame, as the section's grid lays them out, with
 * the padding and the gaps that keep their size at every zoom.
 */
export function sectionExtent(
  kind: CanvasSectionKind,
  cells: readonly CanvasCell[],
  reading: CanvasSize,
): CanvasExtent {
  const sized = cells.map((cell) => ({
    column: cell.column,
    height: kind === "document" ? reading.height : (cell.height ?? 0),
    row: cell.row,
    width: kind === "document" ? reading.width : (cell.width ?? 0),
  }));
  const gaps = SECTION_GAPS[kind];
  return {
    columns: axis(
      SECTION_PADDING.left,
      trackSizes(
        sized.map(({ column, width }) => ({ index: column, size: width })),
      ),
      gaps.column,
      SECTION_PADDING.right,
    ),
    rows: axis(
      SECTION_PADDING.top,
      trackSizes(
        sized.map(({ height, row }) => ({ index: row, size: height })),
      ),
      gaps.row,
      SECTION_PADDING.bottom,
    ),
  };
}
