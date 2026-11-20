import type { ReactNode } from "react";

import { mockLink } from "@mokly/mokly";

import { useCurrentPage } from "../../parts/design_navigation.js";
import type { DesignDestination } from "../../parts/destinations.js";

import { CanvasGlyph } from "./glyphs.js";
import type { ZoomPillProps } from "./zoom-pill.js";

/**
 * One zoom control: a link to the artboard that shows its outcome, current
 * where that artboard is the rendered one, or else a picture of itself. A
 * control without text names itself with its label.
 */
function ZoomControl({
  children,
  className,
  label,
  named,
  to,
}: {
  children: ReactNode;
  className: string;
  label: string;
  /** Whether the visible text already names the control. */
  named?: boolean;
  to: DesignDestination | undefined;
}) {
  const current = useCurrentPage();
  const name = named ? {} : { "aria-label": label };
  if (to === undefined)
    return (
      <span className={className} {...(named ? {} : { role: "img" })} {...name}>
        {children}
      </span>
    );
  return (
    <a
      aria-current={current(to)}
      className={className}
      href={mockLink(to)}
      {...name}
    >
      {children}
    </a>
  );
}

/**
 * The canvas zoom at the bottom of the stage: zoom out, the zoom level, zoom
 * in, and Fit. A static artboard runs no script, so each control links to
 * the artboard that shows its outcome, and a control without one is a
 * picture of itself. The Fit presentation is the dock's Fit on a phone,
 * where the reader pinches to zoom.
 */
export function ZoomPillView({
  fitDestination,
  presentation,
  zoom,
  zoomInDestination,
  zoomOutDestination,
}: ZoomPillProps) {
  if (presentation === "fit")
    return (
      <ZoomControl
        className="cv-zoom-fit cv-zoom-fit--icon"
        label="Fit"
        to={fitDestination}
      >
        <CanvasGlyph name="fit" size={19} />
      </ZoomControl>
    );
  return (
    <div aria-label="Zoom" className="cv-zoom" role="group">
      <ZoomControl
        className="cv-zoom-step"
        label="Zoom out"
        to={zoomOutDestination}
      >
        <CanvasGlyph name="minus" />
      </ZoomControl>
      <span className="cv-zoom-value">{zoom}%</span>
      <ZoomControl
        className="cv-zoom-step"
        label="Zoom in"
        to={zoomInDestination}
      >
        <CanvasGlyph name="plus" />
      </ZoomControl>
      <span aria-hidden="true" className="cv-zoom-rule" />
      <ZoomControl
        className="cv-zoom-fit"
        label="Fit"
        named
        to={fitDestination}
      >
        <CanvasGlyph name="fit" size={15} />
        Fit
      </ZoomControl>
    </div>
  );
}
