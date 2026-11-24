/**
 * The zoom of the home's zoom pill, as docs/protocol/cloud/site-chrome.md
 * fixes it: from 8% to 200%, where 1 is 100%. Zoom in multiplies the zoom by
 * 1.25 and Zoom out by 0.8, the step of the product's pill in
 * `packages/ui/src/canvas-stage/canvas-view.ts`, which the site repeats
 * because the home loads no React. A step past an end stops at that end, and
 * a step that lands within half a step of 100% lands on 100%. The step is a
 * factor, so half a step is its square root: a zoom between 0.8944 and
 * 1.118. The pill shows the zoom as a whole percentage. The module is pure;
 * `zoom-pill.ts` runs the pill with it.
 */

/** The ends of the zoom range, 8% and 200%, where 1 is 100%. */
export const ZOOM_RANGE = { max: 2, min: 0.08 } as const;

/** The two steps of the pill, each the name of its button's direction. */
export type ZoomStep = "in" | "out";

/** The factor of one Zoom in. Zoom out multiplies by its inverse, 0.8. */
const FACTOR = 1.25;

/** Half a step, as a factor: a zoom this close to 100% lands on 100%. */
const SNAP = Math.sqrt(FACTOR);

/**
 * The event that the window fires after each press that changes the home's
 * zoom. The measurements island and the Specs spy read the layout again on
 * it, because a zoom change fires no `resize` and, above 100%, no resize
 * observer entry.
 */
export const HOME_ZOOM_EVENT = "home-zoom";

/** The zoom after one press of `step` at `zoom`. */
export function stepZoom(zoom: number, step: ZoomStep): number {
  const next = step === "in" ? zoom * FACTOR : zoom / FACTOR;
  const kept = Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, next));
  return kept > 1 / SNAP && kept < SNAP ? 1 : kept;
}

/** Whether `step` stands at its end of the range at `zoom`. */
export function atRangeEnd(zoom: number, step: ZoomStep): boolean {
  return step === "in" ? zoom >= ZOOM_RANGE.max : zoom <= ZOOM_RANGE.min;
}

/** The zoom as the pill shows it: a whole percentage, such as `41%`. */
export function zoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
