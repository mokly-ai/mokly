/**
 * The label of a canvas frame, above the frame's left edge: the glyph of its
 * kind and its name, and the size tag at the right edge. A use case's step
 * frame leads the name with the step's number in a dark tag, which reads as
 * `Step 1`, and its name is a link with a chevron. A frame that keeps its
 * light view while Dark is chosen adds `Light only` after the name. A frame
 * of Side by side leads the name with its version's tag: `Before` in the
 * dark tag, or `Current` in the signal tag.
 */

import {
  CanvasIcon,
  ChevronIcon,
  type CanvasIconName,
} from "../icons/icons.js";

import type { CanvasFrameKind } from "./canvas-frame.js";

/** The link that a frame's name is, such as a step frame's link to its screen. */
export interface CanvasFrameLink {
  /** The address that the link opens. */
  href: string;
  /** The link's accessible name, which names what the link opens. */
  label: string;
}

/** The version that a frame of Side by side shows. */
export type CanvasFrameSide = "after" | "before";

/** The tag of each version, as the comparison names it. */
const SIDES: Readonly<Record<CanvasFrameSide, string>> = {
  after: "Current",
  before: "Before",
};

/** The glyph that each kind of frame shows in its label. */
const GLYPHS: Readonly<Record<CanvasFrameKind, CanvasIconName>> = {
  component: "component",
  desktop: "desktop",
  document: "document",
  mobile: "mobile",
};

/** The frame's name, as text or as the link that it is. */
function FrameName({
  label,
  link,
}: {
  label: string;
  link: CanvasFrameLink | undefined;
}) {
  const name = <span className="mbk-canvas-frame-name mbk-reset">{label}</span>;
  if (link === undefined) return name;
  return (
    <a
      aria-label={link.label}
      className="mbk-canvas-frame-link mbk-reset"
      href={link.href}
    >
      {name}
      <ChevronIcon size={12} />
    </a>
  );
}

export function FrameLabel({
  kind,
  label,
  lightOnly,
  link,
  side,
  size,
  step,
}: {
  kind: CanvasFrameKind;
  label: string;
  lightOnly: boolean;
  link: CanvasFrameLink | undefined;
  side: CanvasFrameSide | undefined;
  /** The size tag, such as `1280 × 800`; none for a reading frame. */
  size: string | undefined;
  step: number | undefined;
}) {
  // The spaces keep the parts apart in the caption's text; the flex layout
  // spaces them on screen.
  return (
    <figcaption className="mbk-canvas-frame-label mbk-reset">
      <span className="mbk-canvas-frame-title mbk-reset">
        <CanvasIcon name={GLYPHS[kind]} size={12} />
        {side === undefined ? null : (
          <>
            <span className="mbk-canvas-frame-side mbk-reset" data-side={side}>
              {SIDES[side]}
            </span>{" "}
          </>
        )}
        {step === undefined ? null : (
          <>
            <span className="mbk-canvas-frame-step mbk-reset">
              <span className="mbk-canvas-frame-step-word mbk-reset">
                Step{" "}
              </span>
              {step}
            </span>{" "}
          </>
        )}
        <FrameName label={label} link={link} />
        {lightOnly ? (
          <>
            {" "}
            <span className="mbk-canvas-frame-fallback mbk-reset">
              · Light only
            </span>
          </>
        ) : null}
      </span>
      {size === undefined ? null : (
        <span className="mbk-canvas-frame-size mbk-reset">{size}</span>
      )}
    </figcaption>
  );
}
