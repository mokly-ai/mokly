/**
 * The canvas input that a frame's document forwards, under the
 * [frame canvas input contract](../../../../docs/protocol/mokly-frame-canvas-input.md):
 * ⌘ or Ctrl with the wheel and a pinch zoom the canvas about their point,
 * and the canvas keys run their commands. A point arrives in CSS pixels of
 * the frame's visible viewport, before the canvas scales the frame, so it
 * maps to the page through the frame's box on screen.
 */

import type { RefObject } from "react";

import type { FrameEvent } from "@mokly/frame";
import type { CanvasInputEvent } from "@mokly/frame/internal";
import {
  wheelPixels,
  wheelZoom,
  type CanvasCommand,
  type CanvasStageHandle,
} from "@mokly/ui/canvas-stage";

/** Hears the canvas input of a frame's document, with the frame element. */
export type CanvasInputListener = (
  event: CanvasInputEvent,
  frame: HTMLIFrameElement,
) => void;

/** The input that moves the canvas: a wheel, a pinch, or a key. */
export type CanvasGestureEvent = Exclude<
  CanvasInputEvent,
  { type: "canvas-blur" | "canvas-focus" }
>;

/** What the route reads of the canvas: the canvas, its handle, its zoom. */
export interface CanvasInputTarget {
  canvas: RefObject<Pick<HTMLElement, "clientHeight"> | null>;
  handle: RefObject<CanvasStageHandle | null>;
  zoom: RefObject<number>;
}

const CANVAS_INPUT: ReadonlySet<FrameEvent["type"]> = new Set([
  "canvas-blur",
  "canvas-focus",
  "canvas-key",
  "canvas-pinch",
  "canvas-wheel",
] satisfies CanvasInputEvent["type"][]);

/** Whether a frame event is canvas input, which no other listener reads. */
export function isCanvasInput(event: FrameEvent): event is CanvasInputEvent {
  return CANVAS_INPUT.has(event.type);
}

/** The canvas command of each forwarded key. */
const KEY_COMMANDS = {
  fit: "fit",
  "zoom-100": "actual-size",
  "zoom-in": "zoom-in",
  "zoom-out": "zoom-out",
} as const satisfies Record<
  Extract<CanvasInputEvent, { type: "canvas-key" }>["key"],
  CanvasCommand
>;

/**
 * A point of a frame's visible viewport on the page: the frame's box on
 * screen, past its border, at the scale at which the canvas draws it.
 */
export function framePagePoint(
  frame: HTMLIFrameElement,
  point: { x: number; y: number },
): { x: number; y: number } {
  const box = frame.getBoundingClientRect();
  const scaleX = frame.offsetWidth > 0 ? box.width / frame.offsetWidth : 1;
  const scaleY = frame.offsetHeight > 0 ? box.height / frame.offsetHeight : 1;
  return {
    x: box.left + (frame.clientLeft + point.x) * scaleX,
    y: box.top + (frame.clientTop + point.y) * scaleY,
  };
}

/**
 * Move the canvas for one forwarded input of a frame. A key runs its
 * command. A wheel, whose lines and pages count as the canvas's own wheel
 * counts them, and a pinch zoom by their factor about their point in
 * `frame`, or about the stage's centre without a frame.
 */
export function routeFrameInput(
  target: CanvasInputTarget,
  event: CanvasGestureEvent,
  frame: HTMLIFrameElement | null,
): void {
  const handle = target.handle.current;
  if (!handle) return;
  if (event.type === "canvas-key") {
    handle.run(KEY_COMMANDS[event.key]);
    return;
  }
  const factor =
    event.type === "canvas-pinch"
      ? event.scale
      : wheelZoom(
          1,
          wheelPixels(
            event.deltaY,
            event.deltaMode,
            target.canvas.current?.clientHeight ?? 0,
          ),
        );
  if (!frame) {
    handle.zoomTo(target.zoom.current * factor);
    return;
  }
  const page = framePagePoint(frame, event);
  handle.zoomAt(factor, page.x, page.y);
}
