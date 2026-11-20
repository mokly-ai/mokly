import type { CSSProperties } from "react";

import { CanvasGlyph } from "./glyphs.js";
import type { SelectionProps } from "./selection.js";

/** The eight handles: the corners and the middle of each side. */
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

/**
 * The selected instance on a frame: a signal outline with eight square
 * handles, the component's name in a tag above the top-left corner, the
 * instance's size in a tag below the centre, and, where the instance is large
 * enough to read, a redline that measures its padding from the left edge to
 * the content, with the value in a tag outside the box. The selection fills
 * the box that its caller places over the instance, and its marks keep their
 * size at every zoom; the redline's length follows the frame's scale.
 */
export function SelectionView({
  height,
  name,
  padding,
  width,
}: SelectionProps) {
  const redline: (CSSProperties & Record<"--cv-sel-pad", number>) | undefined =
    padding === undefined ? undefined : { "--cv-sel-pad": padding };
  return (
    <div
      aria-label={`${name} selected, ${width} by ${height}`}
      className="cv-sel"
      role="img"
    >
      {HANDLES.map((at) => (
        <span className="cv-sel-handle" data-at={at} key={at} />
      ))}
      <span className="cv-sel-name">
        <CanvasGlyph name="component" size={11} />
        {name}
      </span>
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
