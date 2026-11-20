import type { CSSProperties } from "react";

import type { CanvasFrameProps } from "./canvas-frame.js";
import { CanvasGlyph, type CanvasGlyphName } from "./glyphs.js";

/** The glyph of each frame kind, which its label starts with. */
const GLYPHS: Record<CanvasFrameProps["kind"], CanvasGlyphName> = {
  component: "component",
  desktop: "desktop",
  document: "document",
  mobile: "mobile",
};

/**
 * A bare frame on the canvas: a rectangle with a ring and a soft shadow, a
 * mono label above its left edge and its size above the right edge. The
 * frame holds its document at the nominal size, scaled by the zoom, in the
 * frame's own scheme, so a dark frame's sketch reads the dark preview tokens.
 * A reading frame is responsive, so its label names no size. The entry's
 * slug leads the label where one frame stands for the entry, as on a phone.
 * The overlay, such as a selection, lies over the document unclipped, so its
 * marks can stand outside the frame; the caller places it at the frame's
 * scale, which the frame gives as `--cv-frame-scale`.
 */
export function CanvasFrameView({
  children,
  entry,
  height,
  kind,
  label,
  overlay,
  scheme,
  width,
  zoom,
}: CanvasFrameProps) {
  const style: CSSProperties & Record<`--cv-frame-${string}`, number> = {
    "--cv-frame-w": width,
    "--cv-frame-h": height,
    "--cv-frame-zoom": zoom,
  };
  const viewport = kind === "desktop" || kind === "mobile" ? kind : undefined;
  return (
    <figure
      className="cv-frame"
      data-cv-frame={
        viewport === undefined ? undefined : `${viewport}-${scheme}`
      }
      data-cv-kind={kind}
      data-cv-scheme={scheme}
      data-cv-viewport={viewport}
      data-preview-color-scheme={scheme}
      style={style}
    >
      <figcaption className="cv-frame-label">
        <CanvasGlyph name={GLYPHS[kind]} size={12} />
        <span className="cv-frame-name">
          {entry === undefined || entry === "" ? null : (
            <span className="cv-frame-entry">{entry} · </span>
          )}
          {label}
        </span>
        {kind === "document" ? null : (
          <span className="cv-frame-size">
            {width} × {height}
          </span>
        )}
      </figcaption>
      <div className="cv-frame-clip">
        <div className="cv-frame-scale">{children}</div>
      </div>
      {overlay}
    </figure>
  );
}
