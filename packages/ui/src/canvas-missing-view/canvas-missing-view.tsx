/**
 * The note of a viewport whose previous view was never captured, where that
 * viewport's frame would stand on the canvas: the place keeps the frame's
 * size and label, and the note says that no previous version was captured.
 * The note's second sentence names the other viewport, so it shows only
 * while no frame of that viewport shows; otherwise it is hidden, not
 * rewritten.
 */

import { CanvasFrame } from "../canvas-frame/canvas-frame.js";
import type { FrameScheme } from "../preview-frame/preview-frame.js";
import { PreviewNotCaptured } from "../preview-state/preview-state.js";

export function CanvasMissingView({
  height,
  label,
  otherShown,
  scheme,
  viewport,
  width,
}: {
  /** The nominal height of the frame whose place the note takes. */
  height: number;
  /** The name of that frame, such as `Mobile · Light`. */
  label: string;
  /**
   * Whether a frame of the other viewport shows, which hides the sentence
   * that asks the reader to switch to it.
   */
  otherShown: boolean;
  /** The scheme of the frame whose place the note takes. */
  scheme: FrameScheme;
  /** The viewport that has no previous view. */
  viewport: "desktop" | "mobile";
  /** The nominal width of the frame whose place the note takes. */
  width: number;
}) {
  return (
    <CanvasFrame
      height={height}
      kind={viewport}
      label={label}
      place={
        <div
          className="mbk-canvas-missing-view mbk-reset"
          data-other-shown={otherShown ? "" : undefined}
        >
          <PreviewNotCaptured viewport={viewport} />
        </div>
      }
      scheme={scheme}
      width={width}
    />
  );
}
