import { mockLink } from "@mokly/mokly";

import { CanvasGlyph } from "../canvas/glyphs.js";

import type { FloatingPanelProps } from "./floating-panel.js";

/**
 * The close control of an open sheet: a link to the artboard that shows the
 * sheet closed, or else a picture of itself.
 */
function SheetClose({
  label,
  to,
}: {
  label: string;
  to: FloatingPanelProps["closeDestination"];
}) {
  const glyph = <CanvasGlyph name="close" />;
  return to === undefined ? (
    <span aria-label={label} className="cv-float-close" role="img">
      {glyph}
    </span>
  ) : (
    <a aria-label={label} className="cv-float-close" href={mockLink(to)}>
      {glyph}
    </a>
  );
}

/**
 * A panel that floats over the canvas, 8px from its side, with a 12px radius,
 * a hairline, and a soft shadow: an optional head, the scrolling body, and an
 * optional foot. On a phone it opens as a bottom sheet with a grabber and a
 * close control, where the layout places it; a closed sheet is not drawn.
 */
export function FloatingPanelView({
  children,
  closeDestination,
  foot,
  head,
  label,
  sheet,
  side,
}: FloatingPanelProps) {
  return (
    <section
      aria-label={label}
      className="cv-float"
      data-sheet={sheet ? "" : undefined}
      data-side={side}
    >
      {sheet ? <span aria-hidden="true" className="cv-float-grab" /> : null}
      {head === undefined ? null : <div className="cv-float-head">{head}</div>}
      <div className="cv-float-body">{children}</div>
      {foot === undefined ? null : <div className="cv-float-foot">{foot}</div>}
      {sheet ? (
        <SheetClose
          label={`Close ${label.toLowerCase()}`}
          to={closeDestination}
        />
      ) : null}
    </section>
  );
}
