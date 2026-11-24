/**
 * The canvas input that a frame's document forwards, under the
 * [frame canvas input contract](../../../../docs/protocol/mokly-frame-canvas-input.md):
 * ⌘ or Ctrl with the wheel and a pinch zoom the canvas about their point,
 * and the zoom keys run their commands. A point arrives in CSS pixels of
 * the frame's visible viewport, before the canvas scales the frame, so it
 * maps to the page through the frame's box on screen. The keys of the shell,
 * Escape and the search keys, leave the frame as a bubbling DOM event, so
 * the shell hears them where it hears its own keys: on the document of a
 * standalone shell, and on the root of an embedded one.
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

type CanvasKey = Extract<CanvasInputEvent, { type: "canvas-key" }>["key"];

const SHELL_KEYS = ["escape", "search"] as const satisfies readonly CanvasKey[];

/**
 * A key of the shell that a frame's document forwards: Escape, or one of the
 * search keys `/`, ⌘K and Ctrl+K.
 */
export type ShellKey = (typeof SHELL_KEYS)[number];

/** The input that moves the canvas: a wheel, a pinch, or a zoom key. */
export type CanvasGestureEvent =
  | Extract<CanvasInputEvent, { type: "canvas-pinch" | "canvas-wheel" }>
  | { type: "canvas-key"; key: Exclude<CanvasKey, ShellKey> };

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

/** Whether a value names a key of the shell. */
export function isShellKey(value: unknown): value is ShellKey {
  return SHELL_KEYS.some((key) => key === value);
}

/** The type of the DOM event that carries a key of the shell. */
const SHELL_KEY_EVENT = "mokly-shell-key";

/**
 * Send a key of the shell from an element, such as the frame whose document
 * forwarded it, as a DOM event that bubbles to the shell.
 */
export function sendShellKey(from: Element, key: ShellKey): void {
  from.dispatchEvent(
    new CustomEvent(SHELL_KEY_EVENT, { bubbles: true, detail: key }),
  );
}

/** Hear the keys of the shell that reach `target`, until the cleanup runs. */
export function listenForShellKeys(
  target: EventTarget,
  listener: (key: ShellKey) => void,
): () => void {
  const receive = (event: Event) => {
    const key: unknown = event instanceof CustomEvent ? event.detail : null;
    if (isShellKey(key)) listener(key);
  };
  target.addEventListener(SHELL_KEY_EVENT, receive);
  return () => target.removeEventListener(SHELL_KEY_EVENT, receive);
}

/** The canvas command of each zoom key. */
const KEY_COMMANDS = {
  fit: "fit",
  "zoom-100": "actual-size",
  "zoom-in": "zoom-in",
  "zoom-out": "zoom-out",
} as const satisfies Record<
  Extract<CanvasGestureEvent, { type: "canvas-key" }>["key"],
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
 * Move the canvas for one forwarded input of a frame. A zoom key runs its
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
