/**
 * The canvas input of a canvas frame's document, for the frames of a live
 * entry, whose adapter forwards the input, and for a previous version's
 * frames, which forward it with `listenForCanvasInput`. The input moves the
 * canvas of `CanvasControlContext` that holds the frame. While the document
 * reports keyboard focus, the frame shows the focus glow.
 */

import { useCallback, useContext, useState } from "react";

import type { CanvasInputEvent } from "@mokly/frame/internal";

import { hoveredFrame, routeFrameInput } from "./canvas_input.js";
import { CanvasControlContext } from "./canvas_stage.js";

/**
 * The listener of a canvas frame's document, and whether the document shows
 * keyboard focus. Its wheel, pinch and keys move the canvas that holds the
 * frame: a wheel or a pinch zooms about its point in `frame`, or in the
 * frame under the pointer when the caller cannot name the frame.
 * `canvas-focus` with `visible` lights the glow, and `canvas-blur` or a
 * focus without `visible` puts it out; the mount hook of a live frame sends
 * `canvas-blur` when it disposes of or replaces the document's mount.
 */
export function useCanvasFrameInput(): {
  focusVisible: boolean;
  listener: (event: CanvasInputEvent, frame?: HTMLIFrameElement) => void;
} {
  const control = useContext(CanvasControlContext);
  const [focusVisible, setFocusVisible] = useState(false);
  const listener = useCallback(
    (event: CanvasInputEvent, frame?: HTMLIFrameElement) => {
      if (event.type === "canvas-focus") setFocusVisible(event.visible);
      else if (event.type === "canvas-blur") setFocusVisible(false);
      else if (control)
        routeFrameInput(
          control,
          event,
          frame ?? hoveredFrame(control.canvas.current),
        );
    },
    [control],
  );
  return { focusVisible, listener };
}
