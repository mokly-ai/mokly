import type { ReactNode } from "react";

import { mockLink } from "@mokly/mokly";

import { useCurrentPage } from "../../parts/design_navigation.js";
import type { DesignDestination } from "../../parts/destinations.js";
import { CanvasGlyph } from "../canvas/glyphs.js";
import { zoomPill } from "../canvas/zoom-pill.js";

import type { PhoneDockProps } from "./phone-dock.js";

/** The name and the glyph of each right-panel tab, as the dock shows it. */
const TABS = {
  inspect: { glyph: "inspect", label: "Inspect" },
  changes: { glyph: "changes", label: "Changes" },
} as const;

/**
 * One labelled dock control: a link to the artboard that shows its outcome,
 * current where that artboard is the rendered one, or else a picture.
 */
function DockControl({
  children,
  to,
}: {
  children: ReactNode;
  to: DesignDestination | undefined;
}) {
  const current = useCurrentPage();
  return to === undefined ? (
    <span className="cv-dock-control">{children}</span>
  ) : (
    <a
      aria-current={current(to)}
      className="cv-dock-control"
      href={mockLink(to)}
    >
      {children}
    </a>
  );
}

/**
 * The phone's floating dock, with 44px targets: Catalogue, which opens the
 * catalogue sheet; the right panel's current tab, which names what a tap on
 * the frame does and opens the panel sheet; and the canvas's Fit. With no
 * entry selected, it holds Catalogue alone.
 */
export function PhoneDockView({
  catalogueDestination,
  fitDestination,
  tab,
  tabDestination,
  zoom,
}: PhoneDockProps) {
  return (
    <div aria-label="Canvas controls" className="cv-dock" role="group">
      <DockControl to={catalogueDestination}>
        <CanvasGlyph name="layers" size={19} />
        Catalogue
      </DockControl>
      {tab === undefined ? null : (
        <>
          <span aria-hidden="true" className="cv-dock-rule" />
          <DockControl to={tabDestination}>
            <CanvasGlyph name={TABS[tab].glyph} size={19} />
            {TABS[tab].label}
          </DockControl>
        </>
      )}
      {zoom === undefined ? null : (
        <>
          <span aria-hidden="true" className="cv-dock-rule" />
          <zoomPill.Component
            zoom={zoom}
            presentation="fit"
            {...(fitDestination === undefined ? {} : { fitDestination })}
          />
        </>
      )}
    </div>
  );
}
