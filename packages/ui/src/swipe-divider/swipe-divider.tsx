/**
 * Swipe's divider over a frame: a signal line at its position, with the
 * version before to its left and the current version to its right, a round
 * grip in the middle of the line, and a tag at the top on each side that
 * names its version. The reader drags the grip, or moves the focused grip
 * with the arrow keys, and Home and End send it to its ends. The host gives
 * every frame the same position, so a move of one grip moves the divider on
 * every frame. The divider fills the box of the frame that holds it, and its
 * marks keep their size at every zoom.
 */

import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { CanvasIcon } from "../icons/icons.js";

/** The position where Swipe opens: the middle of the frame. */
export const SWIPE_START = 50;

/** One arrow key's step, in percent of the frame's width. */
const KEY_STEP = 4;

/** How much farther an arrow key moves the grip while Shift is held. */
const SHIFT_FACTOR = 2.5;

/** A position between the frame's edges, in percent from its left edge. */
export function clampSwipe(position: number): number {
  if (Number.isNaN(position)) return SWIPE_START;
  return Math.min(100, Math.max(0, position));
}

/**
 * The position after a key: an arrow moves the grip one step, or two and a
 * half with Shift, and Home and End send it to its ends. Another key does
 * not move it.
 */
export function swipeKeyPosition(
  position: number,
  key: string,
  shift: boolean,
): number | undefined {
  const step = shift ? KEY_STEP * SHIFT_FACTOR : KEY_STEP;
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return clampSwipe(position - step);
    case "ArrowRight":
    case "ArrowUp":
      return clampSwipe(position + step);
    case "Home":
      return 0;
    case "End":
      return 100;
    default:
      return undefined;
  }
}

/**
 * Follow a drag of the grip with native listeners. The grip's press stops
 * there, so the canvas, which listens on an ancestor, starts no pan for it,
 * and the grip takes the focus, so the keys move it next.
 */
function useGripDrag(
  grip: React.RefObject<HTMLSpanElement | null>,
  box: React.RefObject<HTMLDivElement | null>,
  report: React.RefObject<(position: number) => void>,
): void {
  useEffect(() => {
    const element = grip.current;
    const frame = box.current;
    if (!element || !frame) return;
    let dragging: number | undefined;
    const follow = (event: PointerEvent) => {
      const bounds = frame.getBoundingClientRect();
      if (bounds.width > 0)
        report.current(
          clampSwipe(((event.clientX - bounds.left) / bounds.width) * 100),
        );
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      dragging = event.pointerId;
      element.setPointerCapture?.(event.pointerId);
      element.focus({ preventScroll: true });
    };
    const move = (event: PointerEvent) => {
      if (dragging === event.pointerId) follow(event);
    };
    const up = (event: PointerEvent) => {
      if (dragging === event.pointerId) dragging = undefined;
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
    };
  }, [box, grip, report]);
}

export function SwipeDivider({
  label,
  onPosition,
  position,
}: {
  /** The grip's accessible name, which names its frame, such as `Divider, Desktop · Light`. */
  label: string;
  /** Receives each position that the reader moves the grip to. */
  onPosition: (position: number) => void;
  /** Where the divider stands, in percent of the frame's width from its left edge. */
  position: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const grip = useRef<HTMLSpanElement>(null);
  const report = useRef(onPosition);
  report.current = onPosition;
  useGripDrag(grip, box, report);
  const key = (event: KeyboardEvent<HTMLSpanElement>) => {
    const next = swipeKeyPosition(position, event.key, event.shiftKey);
    if (next === undefined) return;
    event.preventDefault();
    onPosition(next);
  };
  const at = clampSwipe(position);
  const place = { "--mbk-swipe-at": `${at}%` } as CSSProperties;
  return (
    <div className="mbk-swipe mbk-reset" ref={box} style={place}>
      <span aria-hidden="true" className="mbk-swipe-line mbk-reset" />
      <span className="mbk-swipe-tag mbk-reset" data-side="before">
        Before
      </span>
      <span className="mbk-swipe-tag mbk-reset" data-side="after">
        Current
      </span>
      <span
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(at)}
        className="mbk-swipe-grip mbk-reset"
        onKeyDown={key}
        ref={grip}
        role="slider"
        tabIndex={0}
      >
        <CanvasIcon name="grip" size={13} />
      </span>
    </div>
  );
}
