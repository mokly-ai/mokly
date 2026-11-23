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
  /**
   * Whether the frame is out of the section: its cell stays, so its document
   * stays loaded, but it takes no room and Fit leaves it out.
   */
  hidden?: boolean | undefined;
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

/**
 * The padding of a section in the compact layout, which draws no box and no
 * head: only the room of the frames' labels above them.
 */
export const COMPACT_PADDING = {
  bottom: 0,
  left: 0,
  right: 0,
  top: 22,
} as const;

/** The gaps of a section in the compact layout, such as a whole variant set. */
export const COMPACT_GAPS: Readonly<
  Record<CanvasSectionKind, { column: number; row: number }>
> = {
  component: { column: 16, row: 34 },
  document: { column: 0, row: 0 },
  screen: { column: 16, row: 34 },
};

/** The padding and the gaps of a section, in its layout's form. */
export function sectionSpacing(
  kind: CanvasSectionKind,
  compact: boolean,
): {
  gaps: { column: number; row: number };
  padding: { bottom: number; left: number; right: number; top: number };
} {
  return compact
    ? { gaps: COMPACT_GAPS[kind], padding: COMPACT_PADDING }
    : { gaps: SECTION_GAPS[kind], padding: SECTION_PADDING };
}

/** The widest reading frame, a comfortable measure for a document. */
export const READING_MAX_WIDTH = 760;

/** The smallest reading frame, so a tiny stage still shows some document. */
const READING_MIN = { height: 160, width: 240 } as const;

/**
 * The nominal size of a reading frame on a stage: the stage's room less
 * Fit's margins and the section's padding, up to the widest reading frame,
 * so a fitted reading frame shows its document at 100%. In the compact
 * layout the frame takes the canvas's width.
 */
export function readingSize(stage: CanvasSize, compact = false): CanvasSize {
  const { padding } = sectionSpacing("document", compact);
  const width = stage.width - 2 * FIT_MARGIN - padding.left - padding.right;
  const height = stage.height - 2 * FIT_MARGIN - padding.top - padding.bottom;
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
 * A section's tracks: each column as wide as its widest shown frame and each
 * row as tall as its tallest, as the section's grid lays them out, with the
 * padding and the gaps that keep their size at every zoom.
 */
export function sectionExtent(
  kind: CanvasSectionKind,
  cells: readonly CanvasCell[],
  reading: CanvasSize,
  compact = false,
): CanvasExtent {
  const sized = cells
    .filter((cell) => !cell.hidden)
    .map((cell) => ({
      column: cell.column,
      height: kind === "document" ? reading.height : (cell.height ?? 0),
      row: cell.row,
      width: kind === "document" ? reading.width : (cell.width ?? 0),
    }));
  const { gaps, padding } = sectionSpacing(kind, compact);
  return {
    columns: axis(
      padding.left,
      trackSizes(
        sized.map(({ column, width }) => ({ index: column, size: width })),
      ),
      gaps.column,
      padding.right,
    ),
    rows: axis(
      padding.top,
      trackSizes(
        sized.map(({ height, row }) => ({ index: row, size: height })),
      ),
      gaps.row,
      padding.bottom,
    ),
  };
}
