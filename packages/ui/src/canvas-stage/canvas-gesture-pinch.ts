/**
 * Safari's pinch on the canvas. WebKit sends a trackpad pinch, and a
 * two-finger pinch on iOS, as `gesturestart`, `gesturechange` and
 * `gestureend`, whose `scale` grows from the start of the gesture. Each later
 * event zooms by its scale over the scale before it, about the gesture's
 * point, and every gesture event cancels the page's own zoom. A touch pinch
 * that the canvas's pointers already zoom only cancels the page's zoom, so
 * the zoom does not double.
 */

import type { CanvasPoint } from "./canvas-view.js";

/** The fields of WebKit's `GestureEvent` that the pinch reads. */
interface GestureFields {
  clientX?: unknown;
  clientY?: unknown;
  scale?: unknown;
}

/** A gesture event's scale, when it is a positive, finite number. */
function scaleOf(event: Event): number | undefined {
  const { scale } = event as GestureFields;
  return typeof scale === "number" && Number.isFinite(scale) && scale > 0
    ? scale
    : undefined;
}

/**
 * Bind Safari's pinch on one canvas element. `zoomBy` multiplies the zoom
 * about a canvas point, `local` maps a page point to the canvas, and
 * `pointerPinch` tells whether the canvas's pointers already zoom a pinch.
 * The returned function removes the listeners.
 */
export function bindGesturePinch(
  canvas: HTMLElement,
  zoomBy: (factor: number, point: CanvasPoint) => void,
  local: (point: { x: number; y: number }) => CanvasPoint,
  pointerPinch: () => boolean,
): () => void {
  let previous = 1;
  const point = (event: Event): CanvasPoint => {
    const { clientX, clientY } = event as GestureFields;
    return typeof clientX === "number" && typeof clientY === "number"
      ? local({ x: clientX, y: clientY })
      : { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
  };
  const start = (event: Event) => {
    event.preventDefault();
    previous = scaleOf(event) ?? 1;
  };
  const step = (event: Event) => {
    event.preventDefault();
    const scale = scaleOf(event);
    if (scale === undefined) return;
    const factor = scale / previous;
    previous = scale;
    if (factor !== 1 && !pointerPinch()) zoomBy(factor, point(event));
  };
  const options = { passive: false };
  canvas.addEventListener("gesturestart", start, options);
  canvas.addEventListener("gesturechange", step, options);
  canvas.addEventListener("gestureend", step, options);
  return () => {
    canvas.removeEventListener("gesturestart", start);
    canvas.removeEventListener("gesturechange", step);
    canvas.removeEventListener("gestureend", step);
  };
}
