/**
 * The canvas input of a live canvas frame, whose adapter mounts its
 * document: a screen's, a component's or a reading frame. The adapter
 * forwards the document's input with the frame element, so a wheel or a
 * pinch zooms about the point under the pointer, on the canvas of
 * `CanvasControlContext` that holds the frame. While the document reports
 * keyboard focus, the frame shows the focus glow.
 */

import { useCallback, useContext, useState } from "react";

import { routeFrameInput, type CanvasInputListener } from "./canvas_input.js";
import { CanvasControlContext } from "./canvas_stage.js";

/**
 * The listener of a live canvas frame's document, and whether the document
 * shows keyboard focus. Its wheel, pinch and keys move the canvas that holds
 * the frame. `canvas-focus` with `visible` lights the glow, and `canvas-blur`
 * or a focus without `visible` puts it out; the mount hook sends
 * `canvas-blur` when it disposes of or replaces the document's mount.
 */
export function useLiveFrameInput(): {
  focusVisible: boolean;
  onCanvasInput: CanvasInputListener;
} {
  const control = useContext(CanvasControlContext);
  const [focusVisible, setFocusVisible] = useState(false);
  const onCanvasInput = useCallback<CanvasInputListener>(
    (event, frame) => {
      if (event.type === "canvas-focus") setFocusVisible(event.visible);
      else if (event.type === "canvas-blur") setFocusVisible(false);
      else if (control) routeFrameInput(control, event, frame);
    },
    [control],
  );
  return { focusVisible, onCanvasInput };
}
