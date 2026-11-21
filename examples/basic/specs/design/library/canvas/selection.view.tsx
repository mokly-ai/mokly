import type { CSSProperties } from "react";

import { CanvasGlyph } from "./glyphs.js";
import type { SelectionProps } from "./selection.js";

/** The handles of each kind: an instance's corners and sides, a frame's corners. */
const HANDLES = {
  instance: ["nw", "n", "ne", "e", "se", "s", "sw", "w"],
  frame: ["nw", "ne", "se", "sw"],
} as const;

/**
 * The selection on a frame: a signal outline with square handles and the
 * selection's size in a tag below the centre. An instance has eight handles,
 * its component's name in a tag above the top-left corner, and, where it is
 * large enough to read, a redline that measures its left padding from inside
 * the border to the content, with the value in a tag outside the box. A selected
 * frame has a handle at each corner, and its own label names it, so it draws
 * no name tag and no redline. The selection fills the box that its caller
 * places, and its marks keep their size at every zoom; the redline's length
 * follows the frame's scale.
 */
export function SelectionView({
  border = 0,
  height,
  kind = "instance",
  name,
  padding,
  width,
}: SelectionProps) {
  const frame = kind === "frame";
  const redline:
    | (CSSProperties & Record<`--cv-sel-${"border" | "pad"}`, number>)
    | undefined =
    frame || padding === undefined
      ? undefined
      : { "--cv-sel-border": border, "--cv-sel-pad": padding };
  return (
    <div
      aria-label={`${name} selected, ${width} by ${height}`}
      className="cv-sel"
      role="img"
    >
      {HANDLES[kind].map((at) => (
        <span className="cv-sel-handle" data-at={at} key={at} />
      ))}
      {frame ? null : (
        <span className="cv-sel-name">
          <CanvasGlyph name="component" size={11} />
          {name}
        </span>
      )}
      <span className="cv-sel-size">
        {width} × {height}
      </span>
      {redline === undefined ? null : (
        <span className="cv-sel-pad" style={redline}>
          <b>{padding}</b>
        </span>
      )}
    </div>
  );
}
