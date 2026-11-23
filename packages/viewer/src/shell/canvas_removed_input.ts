/**
 * The canvas input of a previous version's frames, which have no frame
 * adapter. A canvas key inside a frame's document runs its command on the
 * canvas that holds the frame, as the canvas's own keys do. A wheel with Ctrl
 * or Command, or a pinch, zooms the canvas at the canvas's own wheel rate,
 * about the stage's centre, because the canvas's handle zooms about that
 * point. While the document shows keyboard focus, its frame shows the focus
 * glow.
 */

import { useCallback, useContext, useState, type RefObject } from "react";

import type { CanvasInputEvent } from "@mokly/frame/internal";
import {
  wheelZoom,
  type CanvasCommand,
  type CanvasStageHandle,
} from "@mokly/ui/canvas-stage";

import { CanvasControlContext } from "./canvas_stage.js";

/** What the routing reads of the canvas: its height, its handle, its zoom. */
export interface CanvasInputTarget {
  canvas: RefObject<Pick<HTMLElement, "clientHeight"> | null>;
  handle: RefObject<CanvasStageHandle | null>;
  zoom: RefObject<number>;
}

/** The input that acts on the canvas: its keys, the wheel and the pinch. */
export type CanvasZoomInput = Extract<
  CanvasInputEvent,
  { type: "canvas-key" | "canvas-pinch" | "canvas-wheel" }
>;

/** The canvas command of each key that a frame forwards. */
const COMMANDS = {
  fit: "fit",
  "zoom-100": "actual-size",
  "zoom-in": "zoom-in",
  "zoom-out": "zoom-out",
} as const satisfies Record<
  Extract<CanvasInputEvent, { type: "canvas-key" }>["key"],
  CanvasCommand
>;

/** CSS pixels in one wheel line, as the canvas's own wheel counts them. */
const LINE_HEIGHT = 16;

/** Act on the canvas for one zoom gesture or key from inside a frame. */
export function routeCanvasInput(
  target: CanvasInputTarget,
  event: CanvasZoomInput,
): void {
  const handle = target.handle.current;
  if (!handle) return;
  if (event.type === "canvas-key") {
    handle.run(COMMANDS[event.key]);
    return;
  }
  const zoom = target.zoom.current;
  if (event.type === "canvas-pinch") {
    handle.zoomTo(zoom * event.scale);
    return;
  }
  const unit =
    event.deltaMode === 1
      ? LINE_HEIGHT
      : event.deltaMode === 2
        ? (target.canvas.current?.clientHeight ?? 0)
        : 1;
  handle.zoomTo(wheelZoom(zoom, event.deltaY * unit));
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
