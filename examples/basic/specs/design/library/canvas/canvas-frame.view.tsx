import type { CSSProperties } from "react";

import type { CanvasFrameProps } from "./canvas-frame.js";
import { FrameComparison, SWIPE_SPLIT } from "./frame_compare.js";
import { CanvasGlyph, type CanvasGlyphName } from "./glyphs.js";
import { swipeDivider } from "./swipe-divider.js";

/** The glyph of each frame kind, which its label starts with. */
const GLYPHS: Record<CanvasFrameProps["kind"], CanvasGlyphName> = {
  component: "component",
  desktop: "desktop",
  document: "document",
  mobile: "mobile",
};

/** The tag of each version of Side by side, as the comparison names it. */
const SIDES: Record<NonNullable<CanvasFrameProps["side"]>, string> = {
  after: "Current",
  before: "Before",
};

/**
 * A bare frame on the canvas: a rectangle with a ring and a soft shadow, a
 * mono label above its left edge and its size above the right edge. The
 * frame holds its document at the nominal size, scaled by the zoom, in the
 * frame's own scheme, so a dark frame's sketch reads the dark preview tokens.
 * A reading frame is responsive, so its label names no size. The entry's
 * slug leads the label where one frame stands for the entry, as on a phone.
 * In a comparison, the frame holds both versions, the version before under
 * the current one, and Swipe draws its divider over them; a frame of Side by
 * side names its version in a tag before its label. The overlay, such as a
 * selection, lies over the document unclipped, so its marks can stand
 * outside the frame; the caller places it at the frame's scale, which the
 * frame gives as `--cv-frame-scale`. A screen's frame is named by its
 * viewport and scheme, and a component's frame by its saved variant and
 * scheme, as the compact frame picker names them. A selected frame's label
 * takes the signal.
 */
export function CanvasFrameView({
  before,
  children,
  compare,
  entry,
  height,
  kind,
  label,
  overlay,
  scheme,
  selected,
  side,
  variant,
  width,
  zoom,
}: CanvasFrameProps) {
  const style: CSSProperties & Record<`--cv-frame-${string}`, number | string> =
    {
      "--cv-frame-w": width,
      "--cv-frame-h": height,
      "--cv-frame-zoom": zoom,
      ...(compare === "swipe" ? { "--cv-frame-split": `${SWIPE_SPLIT}%` } : {}),
    };
  const viewport = kind === "desktop" || kind === "mobile" ? kind : undefined;
  const name =
    viewport ?? (kind === "component" && variant ? variant : undefined);
  return (
    <figure
      className="cv-frame"
      data-cv-frame={name === undefined ? undefined : `${name}-${scheme}`}
      data-cv-kind={kind}
      data-cv-scheme={scheme}
      data-cv-selected={selected ? "" : undefined}
      data-cv-side={side}
      data-cv-viewport={viewport}
      data-preview-color-scheme={scheme}
      style={style}
    >
      <figcaption className="cv-frame-label">
        <CanvasGlyph name={GLYPHS[kind]} size={12} />
        {/* The space keeps the tag and the label apart in the caption's
            text; the flex layout spaces them on screen. */}
        {side === undefined ? null : (
          <>
            <span className="cv-frame-side" data-side={side}>
              {SIDES[side]}
            </span>{" "}
          </>
        )}
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
        <div className="cv-frame-scale">
          {compare === undefined ? (
            children
          ) : (
            <FrameComparison
              before={before}
              compare={compare}
              current={children}
            />
          )}
        </div>
      </div>
      {compare === "swipe" ? (
        <>
          <swipeDivider.Component position={SWIPE_SPLIT} />
          {overlay}
        </>
      ) : (
        overlay
      )}
    </figure>
  );
}
