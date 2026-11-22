/**
 * The reader's gestures on the canvas: a drag around the frames pans it, and
 * a press without movement stays a click; the wheel and a two-finger
 * trackpad scroll pan it; ⌘ or Ctrl with the wheel, a trackpad pinch, which
 * arrives as a wheel event with Ctrl, and a two-finger touch pinch zoom it
 * about the pointer or the pinch. One finger on a touch screen pans. A frame's
 * document is its own page, so the wheel and a swipe over a frame scroll that
 * document and never reach the canvas.
 */

import type { CanvasPoint } from "./canvas-view.js";

/** What the canvas does for each gesture. */
export interface CanvasGestureHandlers {
  /** Whether a press on a target starts no pan, such as on a control. */
  ignores(target: EventTarget | null): boolean;
  /** Move the section by a distance in CSS pixels. */
  pan(dx: number, dy: number): void;
  /** Mark the canvas while the reader drags it. */
  panning(active: boolean): void;
  /** Multiply the zoom by a factor about a canvas point. */
  zoomBy(factor: number, point: CanvasPoint): void;
  /** Zoom for a wheel distance in CSS pixels about a canvas point. */
  zoomWheel(deltaY: number, point: CanvasPoint): void;
}

/** How far a press moves before it is a drag, in CSS pixels. */
const DRAG_THRESHOLD = 4;

/** CSS pixels in one wheel line, for a wheel that counts lines. */
const LINE_HEIGHT = 16;

interface Drag {
  id: number;
  moved: boolean;
  start: { x: number; y: number };
}

function distance(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function middle(
  first: { x: number; y: number },
  second: { x: number; y: number },
): { x: number; y: number } {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

/**
 * Bind the gestures of one canvas element. `handlers` gives the current
 * handlers at each event. The returned function removes every listener.
 */
export function bindCanvasGestures(
  canvas: HTMLElement,
  handlers: () => CanvasGestureHandlers,
): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: Drag | undefined;
  let swallowClick = false;
  const local = (point: { x: number; y: number }): CanvasPoint => {
    const bounds = canvas.getBoundingClientRect();
    return { x: point.x - bounds.left, y: point.y - bounds.top };
  };

  const down = (event: PointerEvent) => {
    swallowClick = false;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (handlers().ignores(event.target)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1)
      drag = {
        id: event.pointerId,
        moved: false,
        start: { x: event.clientX, y: event.clientY },
      };
    else if (drag) drag.moved = true;
  };

  const move = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      pointers.set(event.pointerId, current);
      const before = middle(previous, other);
      const after = middle(current, other);
      const span = distance(previous, other);
      handlers().pan(after.x - before.x, after.y - before.y);
      if (span > 0)
        handlers().zoomBy(distance(current, other) / span, local(after));
      return;
    }
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved) {
      // The press keeps its place until it travels far enough to drag, so
      // the drag then moves the section by the whole distance.
      if (distance(drag.start, current) < DRAG_THRESHOLD) return;
      drag.moved = true;
      canvas.setPointerCapture(event.pointerId);
      handlers().panning(true);
    }
    pointers.set(event.pointerId, current);
    handlers().pan(current.x - previous.x, current.y - previous.y);
  };

  const up = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (drag?.id !== event.pointerId) return;
    if (drag.moved) {
      swallowClick = true;
      handlers().panning(false);
    }
    drag = undefined;
  };

  // A drag ends without the click that its release would make.
  const click = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    const unit =
      event.deltaMode === 1
        ? LINE_HEIGHT
        : event.deltaMode === 2
          ? canvas.clientHeight
          : 1;
    const dx = event.deltaX * unit;
    const dy = event.deltaY * unit;
    if (event.ctrlKey || event.metaKey)
      handlers().zoomWheel(dy, local({ x: event.clientX, y: event.clientY }));
    else if (event.shiftKey && dx === 0) handlers().pan(-dy, 0);
    else handlers().pan(-dx, -dy);
  };

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("click", click, true);
  canvas.addEventListener("wheel", wheel, { passive: false });
  return () => {
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
    canvas.removeEventListener("click", click, true);
    canvas.removeEventListener("wheel", wheel);
    if (drag?.moved) handlers().panning(false);
  };
}
