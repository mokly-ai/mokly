/**
 * The canvas input of a previous version's frames, which have no frame
 * adapter. A canvas key inside a frame's document runs its command on the
 * canvas that holds the frame, as the canvas's own keys do. A wheel with Ctrl
 * or Command, or a pinch, zooms the canvas at the canvas's own wheel rate,
 * about its point in the frame under the pointer. While the document shows
 * keyboard focus, its frame shows the focus glow.
 */

import { useCallback, useContext, useState } from "react";

import type { CanvasInputEvent } from "@mokly/frame/internal";

import {
  hoveredFrame,
  routeFrameInput,
  type CanvasInputTarget,
} from "./canvas_input.js";
import { CanvasControlContext } from "./canvas_stage.js";

export type { CanvasInputTarget } from "./canvas_input.js";

/** The input that acts on the canvas: its keys, the wheel and the pinch. */
export type CanvasZoomInput = Extract<
  CanvasInputEvent,
  { type: "canvas-key" | "canvas-pinch" | "canvas-wheel" }
>;

/**
 * Act on the canvas for one zoom gesture or key from inside a frame. No
 * adapter names the frame, so a wheel or a pinch zooms about its point in
 * the frame under the pointer, and about the stage's centre without one.
 */
export function routeCanvasInput(
  target: CanvasInputTarget,
  event: CanvasZoomInput,
): void {
  routeFrameInput(target, event, hoveredFrame(target.canvas.current));
}

/**
 * The listener of a previous version's frame, for `SnapshotFrame`'s canvas
 * input, and whether the frame's document shows keyboard focus.
 */
export function useCanvasFrameInput(): {
  focusVisible: boolean;
  listener: (event: CanvasInputEvent) => void;
} {
  const control = useContext(CanvasControlContext);
  const [focusVisible, setFocusVisible] = useState(false);
  const listener = useCallback(
    (event: CanvasInputEvent) => {
      if (event.type === "canvas-focus") setFocusVisible(event.visible);
      else if (event.type === "canvas-blur") setFocusVisible(false);
      else if (control) routeCanvasInput(control, event);
    },
    [control],
  );
  return { focusVisible, listener };
}
