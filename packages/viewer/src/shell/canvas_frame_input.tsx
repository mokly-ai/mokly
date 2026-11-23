/**
 * The canvas input of a live canvas frame, whose adapter mounts its
 * document: a screen's, a component's or a reading frame. The adapter
 * forwards the document's input with the frame element, so a wheel or a
 * pinch zooms about the point under the pointer, on the canvas of
 * `CanvasControlContext` that holds the frame.
 */

import { useCallback, useContext } from "react";

import { routeFrameInput, type CanvasInputListener } from "./canvas_input.js";
import { CanvasControlContext } from "./canvas_stage.js";

/**
 * The listener of a live canvas frame's document: its wheel, pinch and keys
 * move the canvas that holds the frame.
 */
export function useLiveFrameInput(): CanvasInputListener {
  const control = useContext(CanvasControlContext);
  return useCallback(
    (event, frame) => {
      if (event.type === "canvas-focus" || event.type === "canvas-blur") return;
      if (control) routeFrameInput(control, event, frame);
    },
    [control],
  );
}
