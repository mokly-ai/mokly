/**
 * The canvas input of a canvas frame's documents, for the frames of a live
 * entry, whose adapter forwards the input, and for a previous version's
 * frames and a comparison's panes, which forward it with
 * `listenForCanvasInput`. The input moves the canvas of
 * `CanvasControlContext` that holds the frame. While a document of the frame
 * reports keyboard focus, the frame shows the focus glow.
 */

import { useCallback, useContext, useState } from "react";

import type { CanvasInputEvent } from "@mokly/frame/internal";

import { routeFrameInput } from "./canvas_input.js";
import { CanvasControlContext } from "./canvas_stage.js";

/** The documents that show keyboard focus, by the frame element of each. */
type Focused = ReadonlySet<HTMLIFrameElement | null>;

/** The focused documents after a focus event of the document in `frame`. */
function focusChange(
  current: Focused,
  frame: HTMLIFrameElement | null,
  visible: boolean,
): Focused {
  if (current.has(frame) === visible) return current;
  const next = new Set(current);
  if (visible) next.add(frame);
  else next.delete(frame);
  return next;
}

/**
 * The listener of a canvas frame's documents, and whether one of them shows
 * keyboard focus. Their wheel, pinch and keys move the canvas that holds the
 * frame: a wheel or a pinch zooms about its point in `frame`, and about the
 * stage's centre when the caller names no frame. `canvas-focus` with
 * `visible` lights the glow for the document in `frame`, and `canvas-blur`
 * or a focus without `visible` puts it out for that document, so a frame
 * whose two layers each hold a document keeps the glow while either shows
 * focus. The mount hook of a live frame sends `canvas-blur` when it disposes
 * of or replaces the document's mount.
 */
export function useCanvasFrameInput(): {
  focusVisible: boolean;
  listener: (event: CanvasInputEvent, frame?: HTMLIFrameElement) => void;
} {
  const control = useContext(CanvasControlContext);
  const [focused, setFocused] = useState<Focused>(() => new Set());
  const listener = useCallback(
    (event: CanvasInputEvent, frame?: HTMLIFrameElement) => {
      const element = frame ?? null;
      if (event.type === "canvas-focus")
        setFocused((current) => focusChange(current, element, event.visible));
      else if (event.type === "canvas-blur")
        setFocused((current) => focusChange(current, element, false));
      else if (control) routeFrameInput(control, event, element);
    },
    [control],
  );
  return { focusVisible: focused.size > 0, listener };
}
