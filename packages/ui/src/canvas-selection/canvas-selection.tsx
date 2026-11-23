/**
 * The selection on a canvas frame, which the frame holds over its document:
 * a signal outline with square handles, and a size tag below the middle. A
 * selected instance has eight handles, a tag above its top-left corner that
 * names its component, and, where it has a left padding, a redline that
 * measures that padding from inside the border to the content, with its
 * value in a tag outside the box. A selected frame has a handle at each
 * corner, and its own label names it, so it draws no name tag and no
 * redline.
 *
 * The box is in the CSS pixels of the frame's document, and the frame's
 * scale places it, so the outline follows each pan and zoom without a
 * render. The handles and the tags keep their size at every zoom, and the
 * redline's length follows the frame's scale. The tags follow the canvas's
 * one rule for fixed-size tags on a frame, and the redline hides while the
 * padding is too narrow on screen to read. The selection lets the pointer
 * through to the frame.
 */

import type { CSSProperties } from "react";

import { CanvasIcon } from "../icons/canvas-icons.js";

/** A box in the CSS pixels of the frame's document, from its origin. */
export interface CanvasSelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The handles of each kind: an instance's corners and sides, a frame's corners. */
const HANDLES = {
  instance: ["nw", "n", "ne", "e", "se", "s", "sw", "w"],
  frame: ["nw", "ne", "se", "sw"],
} as const;

export function CanvasSelection({
  border = 0,
  box,
  kind,
  name,
  padding,
  size,
}: {
  /** The instance's left border, from which the redline starts. */
  border?: number | undefined;
  /** Where the outline stands. A frame's selection covers the whole frame. */
  box?: CanvasSelectionBox | undefined;
  kind: "frame" | "instance";
  /** The instance's component, or the frame's name. */
  name: string;
  /** The instance's left padding in whole CSS pixels, which the redline measures. */
  padding?: number | undefined;
  /** The size that the size tag reads, in whole CSS pixels. */
  size: { width: number; height: number };
}) {
  const frame = kind === "frame";
  const place = (
    box === undefined
      ? {}
      : {
          "--mbk-selection-x": box.x,
          "--mbk-selection-y": box.y,
          "--mbk-selection-width": box.width,
          "--mbk-selection-height": box.height,
        }
  ) as CSSProperties;
  const redline =
    frame || padding === undefined || padding <= 0
      ? undefined
      : ({
          "--mbk-selection-border": border,
          "--mbk-selection-padding": padding,
        } as CSSProperties);
  return (
    <div
      aria-label={`${name} selected, ${size.width} by ${size.height}`}
      className="mbk-canvas-selection mbk-reset"
      data-canvas-selection={kind}
      data-selection-box={box === undefined ? undefined : ""}
      role="img"
      style={place}
    >
      {HANDLES[kind].map((at) => (
        <span
          className="mbk-canvas-selection-handle mbk-reset"
          data-at={at}
          key={at}
        />
      ))}
      {frame ? null : (
        <span className="mbk-canvas-selection-name mbk-canvas-tag mbk-reset">
          <CanvasIcon name="component" size={11} />
          {name}
        </span>
      )}
      <span className="mbk-canvas-selection-size mbk-canvas-tag mbk-reset">
        {size.width} × {size.height}
      </span>
      {redline === undefined ? null : (
        <span
          className="mbk-canvas-selection-pad mbk-canvas-tag mbk-reset"
          style={redline}
        >
          <b className="mbk-reset">{padding}</b>
        </span>
      )}
    </div>
  );
}
