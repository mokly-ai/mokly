/**
 * Where a part sits on a canvas of the home: the spot of an artboard or a
 * component set, in pixels from the canvas origin, and the inline position
 * that places it there. `Artboard.astro` and the spread read them.
 */

/** A spot on a canvas, in pixels from its origin. */
export interface CanvasSpot {
  readonly x: number;
  readonly y: number;
}

/**
 * The inline position of an element at one spot of a canvas, such as
 * `left: 30px; top: 78px`, for an element that the place's rule positions
 * absolutely. Without a spot the element keeps its place in the flow, and
 * the result is `undefined`, so it writes no style.
 */
export function spotStyle(at: CanvasSpot | undefined): string | undefined {
  return at === undefined ? undefined : `left: ${at.x}px; top: ${at.y}px`;
}
