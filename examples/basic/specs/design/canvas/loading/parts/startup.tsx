import type { ReactNode } from "react";

import type { ArtboardViewport } from "../../../parts/artboards.js";
import { DesignNavigation } from "../../../parts/design_navigation.js";
import type { CanvasDestination } from "../../parts/destinations.js";
import { CanvasRoot } from "../../parts/shell.js";

/**
 * A page that the shell draws before the catalogue arrives. It has no top
 * bar, canvas, panel, or dock yet, so its one state takes the place of the
 * viewer root, in the Canvas palette of the reader's appearance. The Canvas
 * root carries the theme's root class itself, so the state sits in it
 * directly: a second root class around the state would declare the shipped
 * theme's tokens over the Canvas palette.
 */
export function StartupPage({
  children,
  design,
  viewport,
}: {
  children: ReactNode;
  design: CanvasDestination;
  viewport: ArtboardViewport;
}) {
  return (
    <DesignNavigation design={design}>
      <CanvasRoot viewport={viewport}>{children}</CanvasRoot>
    </DesignNavigation>
  );
}
