import type { CSSProperties, ReactNode } from "react";

import { mockLink } from "@mokly/mokly";

import { useCurrentPage } from "../../parts/design_navigation.js";
import type { DesignDestination } from "../../parts/destinations.js";

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
 * A step frame's name as the link that opens the step's screen, with a
 * chevron that points on to it; current where that screen's artboard is the
 * rendered one.
 */
function ScreenLink({
  children,
  to,
}: {
  children: ReactNode;
  to: DesignDestination;
}) {
  const current = useCurrentPage();
  return (
    <a aria-current={current(to)} className="cv-frame-link" href={mockLink(to)}>
      {children}
      <CanvasGlyph name="chevron" size={12} />
    </a>
  );
}

/**
 * A bare frame on the canvas: a rectangle with a ring and a soft shadow, a
 * mono label above its left edge and its size in whole CSS pixels above the
 * right edge. The frame holds its document at the nominal size, scaled by
 * the zoom, in the frame's own scheme, so a dark frame's sketch reads the
 * dark preview tokens.
 * A reading frame is responsive, so its label names no size. The entry's
 * slug leads the label where one frame stands for the entry, as on a phone.
 * In a comparison, the frame holds both versions, the version before under
 * the current one, and Swipe draws its divider over them; a frame of Side by
 * side names its version in a tag before its label. The overlay, such as a
 * selection, lies over the document unclipped, so its marks can stand
 * outside the frame; the caller places it at the frame's scale, which the
 * frame gives as `--cv-frame-scale`. A screen's frame is named by its
 * viewport and scheme, and a component's frame by its saved variant, or by
 * the component's title for its own example, and its scheme, as the compact
 * frame picker names them. The label of the frame
 * that holds the selection, an instance on it or the frame itself, takes the
 * signal. A use case's step frame is named by its step: the step's number
 * in a tag leads the label, the step's title is the link that opens the
 * step's screen, and the step's description reads muted below the label. A
 * frame that keeps its light view under Dark, because its entry has no dark
 * view, adds `Light only` after its name, in a lighter weight.
 */
export function CanvasFrameView({
  before,
  children,
  compare,
  description,
  entry,
  height,
  kind,
  label,
  lightOnly,
  overlay,
  scheme,
  screenDestination,
  selected,
  side,
  step,
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
  const title = (
    <span className="cv-frame-name">
      {entry === undefined || entry === "" ? null : (
        <span className="cv-frame-entry">{entry} · </span>
      )}
      {label}
    </span>
  );
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
        {step === undefined ? null : (
          <>
            <span className="cv-frame-step">
              <span className="cv-frame-step-word">Step </span>
              {step}
            </span>{" "}
          </>
        )}
        {screenDestination === undefined ? (
          title
        ) : (
          <ScreenLink to={screenDestination}>{title}</ScreenLink>
        )}
        {lightOnly ? (
          <>
            {" "}
            <span className="cv-frame-fallback">· Light only</span>
          </>
        ) : null}
        {kind === "document" ? null : (
          <span className="cv-frame-size">
            {Math.round(width)} × {Math.round(height)}
          </span>
        )}
        {description === undefined ? null : (
          <>
            {" "}
            <span className="cv-frame-note">{description}</span>
          </>
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
