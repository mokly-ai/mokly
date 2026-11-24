/**
 * The canvas zoom: a raised pill, a group named Zoom, that holds Zoom out,
 * the zoom as a whole percentage, Zoom in, and Fit. The pill acts through its
 * callbacks; the canvas that shows it holds the zoom. In a static depiction
 * that runs no script, each control is a picture of itself.
 */

import { CanvasIcon, type CanvasIconName } from "../icons/icons.js";

/** The zoom as the pill shows it: a whole percentage, such as `38%`. */
export function zoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/** Zoom out or Zoom in: a button, or a picture of itself. */
function ZoomStep({
  glyph,
  interactive,
  label,
  onPress,
}: {
  glyph: CanvasIconName;
  interactive: boolean;
  label: string;
  onPress(): void;
}) {
  if (!interactive)
    return (
      <span
        aria-label={label}
        className="mbk-zoom-step mbk-reset"
        role="img"
        title={label}
      >
        <CanvasIcon name={glyph} />
      </span>
    );
  return (
    <button
      aria-label={label}
      className="mbk-zoom-step mbk-reset"
      onClick={onPress}
      title={label}
      type="button"
    >
      <CanvasIcon name={glyph} />
    </button>
  );
}

/** Fit: a button with its word, or a picture of itself. */
function ZoomFit({
  interactive,
  onFit,
}: {
  interactive: boolean;
  onFit(): void;
}) {
  const content = (
    <>
      <CanvasIcon name="fit" size={15} />
      Fit
    </>
  );
  if (!interactive)
    return (
      <span
        aria-label="Fit"
        className="mbk-zoom-fit mbk-reset"
        role="img"
        title="Fit"
      >
        {content}
      </span>
    );
  return (
    <button className="mbk-zoom-fit mbk-reset" onClick={onFit} type="button">
      {content}
    </button>
  );
}

export function CanvasZoomPill({
  interactive = true,
  onFit,
  onZoomIn,
  onZoomOut,
  zoom,
}: {
  /**
   * Whether the controls are buttons, as they are by default. A static
   * depiction that runs no script sets `false`, which draws each control as
   * a picture of itself, named by what it would do.
   */
  interactive?: boolean;
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
      <ZoomStep
        glyph="zoom-out"
        interactive={interactive}
        label="Zoom out"
        onPress={onZoomOut}
      />
      <span className="mbk-zoom-value mbk-reset">{zoomPercent(zoom)}</span>
      <ZoomStep
        glyph="zoom-in"
        interactive={interactive}
        label="Zoom in"
        onPress={onZoomIn}
      />
      <span aria-hidden="true" className="mbk-zoom-rule mbk-reset" />
      <ZoomFit interactive={interactive} onFit={onFit} />
    </div>
  );
}
