/** The separator that resizes the catalogue column on a desktop. */

import { useRef } from "react";

/** The narrowest column, in pixels. */
const MINIMUM_WIDTH = 192;
/** The column width that a double click restores, in pixels. */
const DEFAULT_WIDTH = 248;
/** The change of one arrow key press, in pixels. */
const STEP = 16;

/** The width callbacks of the separator. */
export interface ResizeActions {
  /**
   * Receives each width that a drag, a key, or a double click asks for,
   * before the host bounds it. Without it the separator is inert.
   */
  onWidth: ((width: number) => void) | undefined;
  /** Receives the width to keep once a drag, a key, or a double click ends. */
  onWidthCommit: ((width: number) => void) | undefined;
  /** Receives `true` when a drag starts and `false` when it ends. */
  onResizing: ((resizing: boolean) => void) | undefined;
}

/**
 * The separator. A drag with the primary pointer captures it and resizes the
 * column continuously; Left and Right change the width by 16px, Home and End
 * choose its bounds, and a double click restores 248px. A column that is not
 * operable draws only the picture of its grip.
 */
export function ResizeHandle({
  actions,
  maximum,
  operable,
  width,
}: {
  actions: ResizeActions;
  /** The widest column, in pixels. */
  maximum: number;
  /** Whether the separator is a control, or only the picture of its grip. */
  operable: boolean;
  /** The column width, in pixels. */
  width: number;
}) {
  const { onResizing, onWidth, onWidthCommit } = actions;
  const drag = useRef<
    { pointer: number; start: number; width: number } | undefined
  >(undefined);
  // The width to keep: the shown width, or the bounded width of a drag that
  // the host has not shown yet.
  const currentWidth = useRef(width);
  currentWidth.current = width;

  const finish = (handle: HTMLDivElement, pointer: number) => {
    if (drag.current?.pointer !== pointer) return;
    drag.current = undefined;
    onResizing?.(false);
    if (handle.hasPointerCapture(pointer))
      handle.releasePointerCapture(pointer);
    onWidthCommit?.(currentWidth.current);
  };
  if (!operable)
    return (
      <div
        aria-hidden="true"
        className="mbk-nav-resize mbk-reset"
        data-mokly-nav-resize=""
      />
    );
  return (
    <div
      aria-label="Resize navigation panel"
      aria-orientation="vertical"
      aria-valuemax={maximum}
      aria-valuemin={MINIMUM_WIDTH}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      className="mbk-nav-resize mbk-reset"
      data-mokly-nav-resize=""
      onDoubleClick={() => {
        onWidth?.(DEFAULT_WIDTH);
        onWidthCommit?.(DEFAULT_WIDTH);
      }}
      onKeyDown={(event) => {
        if (!onWidth) return;
        let next: number | undefined;
        if (event.key === "ArrowLeft") next = width - STEP;
        if (event.key === "ArrowRight") next = width + STEP;
        if (event.key === "Home") next = MINIMUM_WIDTH;
        if (event.key === "End") next = maximum;
        if (next === undefined) return;
        event.preventDefault();
        onWidth(next);
        onWidthCommit?.(next);
      }}
      onLostPointerCapture={(event) =>
        finish(event.currentTarget, event.pointerId)
      }
      onPointerCancel={(event) => finish(event.currentTarget, event.pointerId)}
      onPointerDown={(event) => {
        if (!onWidth || !event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        drag.current = {
          pointer: event.pointerId,
          start: event.clientX,
          width,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        onResizing?.(true);
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!onWidth || active?.pointer !== event.pointerId) return;
        const next = active.width + event.clientX - active.start;
        currentWidth.current = Math.round(
          Math.max(MINIMUM_WIDTH, Math.min(maximum, next)),
        );
        onWidth(next);
      }}
      onPointerUp={(event) => finish(event.currentTarget, event.pointerId)}
      role="separator"
      tabIndex={0}
      title="Drag to resize. Use arrow keys for precise control."
    />
  );
}
