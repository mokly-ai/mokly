/**
 * The grabber of a sheet: the accessible size toggle at the sheet's top. A
 * press switches the sheet between its compact and its expanded height. A
 * drag moves the sheet's top edge with the pointer, and the sheet then snaps
 * to the nearer of its two heights. A static depiction draws a picture of
 * the grabber instead.
 */

import { useRef } from "react";
import type { PointerEvent } from "react";

/** The heights of a sheet, as parts of the height of the area it covers. */
const COMPACT = 0.64;
const EXPANDED = 0.88;

/** The distance that a press moves before it is a drag, in pixels. */
const DRAG_THRESHOLD = 5;

interface Drag {
  /** The height of the area that the sheet covers. */
  area: number;
  height: number;
  moved: boolean;
  pointer: number;
  y: number;
}

/** The sheet whose grabber received a pointer event. */
function sheetOf(event: PointerEvent<HTMLButtonElement>): HTMLElement | null {
  return event.currentTarget.parentElement;
}

/** The size toggle's name, which says what a press would do. */
function grabLabel(expanded: boolean, noun: string): string {
  return expanded ? `Make ${noun} compact` : `Expand ${noun}`;
}

/**
 * The grabber of a static depiction that runs no script: a picture of
 * itself, named by what a press would do, with no tab stop and no pointer.
 */
export function SheetGrabPicture({
  expanded,
  noun,
}: {
  expanded: boolean;
  noun: string;
}) {
  const label = grabLabel(expanded, noun);
  return (
    <span
      aria-label={label}
      className="mbk-float-grab mbk-reset"
      data-sheet-grab=""
      role="img"
      title={label}
    >
      <span className="mbk-float-grip mbk-reset" />
    </span>
  );
}

export function SheetGrab({
  expanded,
  noun,
  onDrag,
  onExpandedChange,
}: {
  expanded: boolean;
  /** What the sheet holds, such as `catalogue`, which names the toggle. */
  noun: string;
  /** Receives the sheet's height during a drag, and `undefined` after it. */
  onDrag(height: number | undefined): void;
  onExpandedChange(expanded: boolean): void;
}) {
  const drag = useRef<Drag | undefined>(undefined);
  // A drag ends with a click on the grabber, which must not toggle again.
  const dragged = useRef(false);
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (active?.pointer !== event.pointerId) return;
    drag.current = undefined;
    onDrag(undefined);
    dragged.current = active.moved;
    if (!active.moved) return;
    const height = active.height + active.y - event.clientY;
    onExpandedChange(height > ((COMPACT + EXPANDED) / 2) * active.area);
  };
  return (
    <button
      aria-expanded={expanded}
      aria-label={grabLabel(expanded, noun)}
      className="mbk-float-grab mbk-reset"
      data-sheet-grab=""
      onClick={() => {
        if (dragged.current) dragged.current = false;
        else onExpandedChange(!expanded);
      }}
      onLostPointerCapture={finish}
      onPointerCancel={finish}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        const sheet = sheetOf(event);
        if (!sheet) return;
        drag.current = {
          area: sheet.offsetParent?.clientHeight ?? window.innerHeight,
          height: sheet.getBoundingClientRect().height,
          moved: false,
          pointer: event.pointerId,
          y: event.clientY,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (active?.pointer !== event.pointerId) return;
        const delta = active.y - event.clientY;
        active.moved ||= Math.abs(delta) > DRAG_THRESHOLD;
        if (!active.moved) return;
        onDrag(
          Math.min(active.area, Math.max(0, Math.round(active.height + delta))),
        );
      }}
      onPointerUp={finish}
      type="button"
    >
      <span className="mbk-float-grip mbk-reset" />
    </button>
  );
}
