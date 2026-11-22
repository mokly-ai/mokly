/**
 * The canvas zoom: a raised pill, a group named Zoom, that holds Zoom out,
 * the zoom as a whole percentage, Zoom in, and Fit. The pill acts through its
 * callbacks; the canvas that shows it holds the zoom.
 */

import { CanvasIcon } from "../icons/icons.js";

/** The zoom as the pill shows it: a whole percentage, such as `38%`. */
export function zoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export function CanvasZoomPill({
  onFit,
  onZoomIn,
  onZoomOut,
  zoom,
}: {
  /** Receives each press of Fit. */
  onFit(): void;
  /** Receives each press of Zoom in. */
  onZoomIn(): void;
  /** Receives each press of Zoom out. */
  onZoomOut(): void;
  /** The canvas's zoom, where 1 is 100%. */
  zoom: number;
}) {
  return (
    <div aria-label="Zoom" className="mbk-zoom-pill mbk-reset" role="group">
      <button
        aria-label="Zoom out"
        className="mbk-zoom-step mbk-reset"
        onClick={onZoomOut}
        title="Zoom out"
        type="button"
      >
        <CanvasIcon name="zoom-out" />
      </button>
      <span className="mbk-zoom-value mbk-reset">{zoomPercent(zoom)}</span>
      <button
        aria-label="Zoom in"
        className="mbk-zoom-step mbk-reset"
        onClick={onZoomIn}
        title="Zoom in"
        type="button"
      >
        <CanvasIcon name="zoom-in" />
      </button>
      <span aria-hidden="true" className="mbk-zoom-rule mbk-reset" />
      <button className="mbk-zoom-fit mbk-reset" onClick={onFit} type="button">
        <CanvasIcon name="fit" size={15} />
        Fit
      </button>
    </div>
  );
}
