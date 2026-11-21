import type { ReactNode } from "react";

import {
  MainRegion,
  SkipLink,
} from "../../../../../../packages/ui/src/shell-layout/shell-layout.js";
import { zoomPill } from "../../library/canvas/zoom-pill.js";
import { optional, useDesignInstance } from "../../library/composition.js";
import { phoneDock } from "../../library/panels/phone-dock.js";
import { useRenderedAppearance } from "../../parts/appearance.js";
import { canvasScope } from "../../parts/canvas_palette.js";
import {
  DesignNavigation,
  useDesignNavigation,
} from "../../parts/design_navigation.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { TopBar } from "../../parts/top_bar.js";

import { CanvasCatalogue, type CatalogueView } from "./catalogue.js";
import { CANVAS_PAGES, type CanvasDestination } from "./destinations.js";
import type { CanvasEntry } from "./entries.js";
import { RightPanel, type PanelTab } from "./panel.js";

/** The sheet that a compact artboard shows open. */
export type CanvasSheet = "catalogue" | "panel";

interface CanvasShellProps {
  design: CanvasDestination;
  viewport: ArtboardViewport;
  /** The catalogue's filter and its selected row. */
  catalogue: CatalogueView;
  /** The selected entry, which the right panel inspects; none on home. */
  entry?: CanvasEntry | undefined;
  /** The body of the right panel's selected tab. */
  panel?: ReactNode;
  /** The right panel's selected tab, which the dock names; Inspect by default. */
  tab?: PanelTab | undefined;
  /** The sheet that the compact form shows open. */
  sheet?: CanvasSheet | undefined;
  /** The open sheet takes its expanded height, as after a drag on its grabber. */
  expanded?: boolean | undefined;
  /** The pill above the dock that names the selection, in the compact form. */
  pill?: ReactNode;
  /** The stage's zoom in percent, which the zoom pill shows. */
  zoom?: number | undefined;
  /** The compact form's zoom in percent, which the dock's Fit restores. */
  compactZoom?: number | undefined;
  /** The stage on the canvas. */
  children: ReactNode;
}

/** The id of the main region, one shell per document. */
const MAIN_ID = "cv-main";

/**
 * The root of a Canvas artboard: the theme's root class with the Canvas
 * palette in the rendered appearance, and the design artboard class, whose
 * Highlight components rule reveals the frames' highlight. A mobile render
 * draws the compact form at every width.
 */
function CanvasRoot({
  children,
  viewport,
}: {
  children: ReactNode;
  viewport: ArtboardViewport;
}) {
  const scope = canvasScope(useRenderedAppearance());
  return (
    <div
      {...scope}
      className={`${scope.className} ce-design cv-root`}
      data-cv-layout={viewport === "mobile" ? "compact" : undefined}
    >
      {children}
    </div>
  );
}

/**
 * The Canvas viewer shell of one artboard: the top bar over a full-bleed
 * dot-grid canvas, the floating catalogue and right panel, the zoom pill, and
 * the compact form's dock. A desktop render draws both floating panels and
 * the zoom pill, and turns compact below the shell's breakpoint. A mobile
 * render draws only the sheet it shows open, and the dock, whose Fit takes
 * the zoom pill's place.
 */
export function CanvasShell(props: CanvasShellProps) {
  return (
    <DesignNavigation design={props.design}>
      <CanvasRoot viewport={props.viewport}>
        <SkipLink href={`#${MAIN_ID}`} />
        <CanvasTopBar {...props} />
        <MainRegion id={MAIN_ID}>
          <CanvasWork {...props} />
        </MainRegion>
      </CanvasRoot>
    </DesignNavigation>
  );
}

/**
 * The package top bar. Its brand opens the Canvas home, and its menu opens
 * the catalogue sheet, as the dock's Catalogue does, or closes the open one.
 */
function CanvasTopBar({ design, sheet, viewport }: CanvasShellProps) {
  const transitions = useDesignNavigation().canvas ?? {};
  const open = viewport === "mobile" && sheet === "catalogue";
  const menu = open
    ? transitions.close
    : design === CANVAS_PAGES.catalogue
      ? undefined
      : CANVAS_PAGES.catalogue;
  return (
    <TopBar
      drawerOpen={open}
      links={{ brand: CANVAS_PAGES.home, menu }}
      viewport={viewport}
    />
  );
}

function CanvasWork({
  catalogue,
  children,
  compactZoom,
  design,
  entry,
  expanded,
  panel,
  pill,
  sheet,
  tab = "inspect",
  viewport,
  zoom,
}: CanvasShellProps) {
  const transitions = useDesignNavigation().canvas ?? {};
  const compact = viewport === "mobile";
  const zoomInstance = useDesignInstance("zoom");
  const dockInstance = useDesignInstance("dock");
  return (
    <div className="cv-work" data-cv-sheet={expanded ? "expanded" : undefined}>
      <div className="cv-canvas">{children}</div>
      {!compact && zoom !== undefined ? (
        <div className="cv-zoom-place">
          <zoomPill.Component
            moklyInstance={zoomInstance}
            zoom={zoom}
            presentation="pill"
            {...optional("zoomInDestination", transitions.zoomIn)}
            {...optional("zoomOutDestination", transitions.zoomOut)}
            {...optional("fitDestination", transitions.fit)}
          />
        </div>
      ) : null}
      {!compact || sheet === "catalogue" ? (
        <CanvasCatalogue
          sheet={compact}
          view={catalogue}
          close={transitions.close}
          design={design}
        />
      ) : null}
      {entry !== undefined && (!compact || sheet === "panel") ? (
        <RightPanel
          close={transitions.close}
          design={design}
          entry={entry}
          selected={tab}
          sheet={compact}
        >
          {panel}
        </RightPanel>
      ) : null}
      {pill === undefined ? null : <div className="cv-pill-place">{pill}</div>}
      <div className="cv-dock-place">
        <phoneDock.Component
          moklyInstance={dockInstance}
          catalogueDestination={CANVAS_PAGES.catalogue}
          {...optional("tab", entry === undefined ? undefined : tab)}
          {...optional("tabDestination", transitions.panelSheet)}
          {...optional("zoom", entry === undefined ? undefined : compactZoom)}
          {...optional("fitDestination", transitions.fit)}
        />
      </div>
    </div>
  );
}
