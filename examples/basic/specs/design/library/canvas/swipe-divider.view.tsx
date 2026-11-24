import type { CSSProperties } from "react";

import { CanvasGlyph } from "./glyphs.js";
import type { SwipeDividerProps } from "./swipe-divider.js";

/**
 * Swipe's divider over a frame: a signal line at its position, with the
 * version before to its left and the current version to its right, a round
 * grip in the middle of the line, and a tag on each side at the top that
 * names the version. A static artboard runs no script, so the grip is a
 * picture of the control that a reader drags; every frame of the stage draws
 * its divider at the same position. The divider fills the frame that its
 * caller places it over, and its marks keep their size at every zoom.
 */
export function SwipeDividerView({ position }: SwipeDividerProps) {
  const place: CSSProperties & Record<"--cv-swipe-at", string> = {
    "--cv-swipe-at": `${position}%`,
  };
  return (
    <div
      aria-label="Divider between Before and Current"
      className="cv-swipe"
      role="img"
      style={place}
    >
      <span className="cv-swipe-line" />
      <span className="cv-swipe-tag" data-side="before">
        Before
      </span>
      <span className="cv-swipe-tag" data-side="after">
        Current
      </span>
      <span className="cv-swipe-grip">
        <CanvasGlyph name="grip" size={13} />
      </span>
    </div>
  );
}
