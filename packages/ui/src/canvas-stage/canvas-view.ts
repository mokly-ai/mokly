/**
 * The arithmetic of the canvas view: where the section stands and at which
 * zoom. A section's lengths along each axis are tracks: a frame's nominal
 * length scales with the zoom, and the section's head, padding and the gaps
 * between frames keep their size. Fit, the zoom steps and a zoom about a
 * point all work on those tracks, so the point under the reader's pointer
 * stays under it although the fixed lengths do not scale.
 */

/** The smallest zoom of the canvas, 8%. */
export const ZOOM_MIN = 0.08;

/** The largest zoom of the canvas, 400%. */
export const ZOOM_MAX = 4;

/** The factor of one Zoom in. Zoom out multiplies by its inverse, 0.8. */
export const ZOOM_STEP = 1.25;

/** The room that Fit leaves between the section and each edge of the stage. */
export const FIT_MARGIN = 16;

/** The wheel distance that changes the zoom by the factor `e`, inverted. */
const WHEEL_ZOOM_RATE = 0.008;

/** One length of a section along an axis: fixed, or nominal times the zoom. */
export type CanvasTrack = { fixed: number } | { scaled: number };

/** A section's tracks from its top left: its columns and its rows. */
export interface CanvasExtent {
  columns: readonly CanvasTrack[];
  rows: readonly CanvasTrack[];
}

/**
 * Where the section stands: its zoom, the canvas position of its top left,
 * and whether Fit placed it, so that the stage refits while it changes size.
 */
export interface CanvasView {
  fitted: boolean;
  x: number;
  y: number;
  zoom: number;
}

/** The stage, in the canvas's own coordinates. */
export interface CanvasRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

/** A point in the canvas's own coordinates. */
export interface CanvasPoint {
  x: number;
  y: number;
}

/** Keep a zoom between 8% and 400%. */
export function clampZoom(zoom: number): number {
  if (Number.isNaN(zoom)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** The fixed and the nominal length of an axis. */
function lengths(tracks: readonly CanvasTrack[]): {
  fixed: number;
  scaled: number;
} {
  let fixed = 0;
  let scaled = 0;
  for (const track of tracks)
    if ("fixed" in track) fixed += track.fixed;
    else scaled += track.scaled;
  return { fixed, scaled };
}

/** The length of an axis at a zoom. */
export function axisLength(
  tracks: readonly CanvasTrack[],
  zoom: number,
): number {
  const { fixed, scaled } = lengths(tracks);
  return fixed + scaled * zoom;
}

/** The largest zoom at which an axis fits a length with Fit's margins. */
function axisZoom(tracks: readonly CanvasTrack[], length: number): number {
  const { fixed, scaled } = lengths(tracks);
  return scaled > 0 ? (length - 2 * FIT_MARGIN - fixed) / scaled : Infinity;
}

/**
 * Where an axis starts so that the section stands centred on the stage. A
 * section that does not fit starts at the margin instead, so its head and
 * its first frame stay on the stage.
 */
function centredStart(start: number, length: number, size: number): number {
  return start + Math.max(FIT_MARGIN, (length - size) / 2);
}

/**
 * Where Fit places the section along the block axis: centred on the stage,
 * or at the stage's top, as the compact layout stands its frame below the
 * entry bar.
 */
export type FitAlign = "centre" | "start";

/**
 * Fit: the largest zoom, up to 100%, at which the section fits the stage less
 * Fit's margins, with the section centred, or centred across the stage and at
 * its top. A stage too small for the section at 8% keeps 8%.
 */
export function fitView(
  extent: CanvasExtent,
  stage: CanvasRect,
  align: FitAlign = "centre",
): CanvasView {
  const zoom = clampZoom(
    Math.min(
      1,
      axisZoom(extent.columns, stage.width),
      axisZoom(extent.rows, stage.height),
    ),
  );
  return {
    fitted: true,
    x: centredStart(stage.left, stage.width, axisLength(extent.columns, zoom)),
    y:
      align === "start"
        ? stage.top + FIT_MARGIN
        : centredStart(stage.top, stage.height, axisLength(extent.rows, zoom)),
    zoom,
  };
}

/**
 * Where an axis starts after a zoom, so that the section point under `point`
 * stays under it. The point's offset in the section splits into its fixed
 * part and its nominal part, track by track; outside the section, the space
 * scales like a frame.
 */
function anchoredStart(
  tracks: readonly CanvasTrack[],
  start: number,
  zoom: number,
  next: number,
  point: number,
): number {
  let rest = point - start;
  let fixed = 0;
  let nominal = 0;
  if (rest > 0)
    for (const track of tracks) {
      const length = "fixed" in track ? track.fixed : track.scaled * zoom;
      const part = Math.min(rest, length);
      if ("fixed" in track) fixed += part;
      else nominal += part / zoom;
      rest -= part;
      if (rest <= 0) break;
    }
  nominal += rest / zoom;
  return point - (fixed + nominal * next);
}

/**
 * Where the canvas draws the section: on whole pixels, so its head and its
 * labels stay sharp. The view keeps the exact position, so slow drags and
 * scrolls add up.
 */
export function drawnPosition(view: CanvasView): CanvasPoint {
  return { x: Math.round(view.x), y: Math.round(view.y) };
}

/**
 * The view at another zoom about a canvas point; the reader then leaves Fit.
 * The point is a point of the drawn section, so it stays under the pointer.
 */
export function zoomAbout(
  view: CanvasView,
  extent: CanvasExtent,
  zoom: number,
  point: CanvasPoint,
): CanvasView {
  const next = clampZoom(zoom);
  const drawn = drawnPosition(view);
  return {
    fitted: false,
    x: anchoredStart(extent.columns, drawn.x, view.zoom, next, point.x),
    y: anchoredStart(extent.rows, drawn.y, view.zoom, next, point.y),
    zoom: next,
  };
}

/** The centre of the stage, about which the zoom steps and 100% zoom. */
export function stageCentre(stage: CanvasRect): CanvasPoint {
  return { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2 };
}

/** One Zoom in or Zoom out step about the stage's centre. */
export function stepZoom(
  view: CanvasView,
  extent: CanvasExtent,
  stage: CanvasRect,
  direction: "in" | "out",
): CanvasView {
  const factor = direction === "in" ? ZOOM_STEP : 1 / ZOOM_STEP;
  return zoomAbout(view, extent, view.zoom * factor, stageCentre(stage));
}

/** The zoom after a wheel or trackpad pinch of `deltaY` CSS pixels. */
export function wheelZoom(zoom: number, deltaY: number): number {
  return zoom * Math.exp(-deltaY * WHEEL_ZOOM_RATE);
}

/** The view moved by a drag or a scroll; the reader then leaves Fit. */
export function panView(view: CanvasView, dx: number, dy: number): CanvasView {
  return { ...view, fitted: false, x: view.x + dx, y: view.y + dy };
}
