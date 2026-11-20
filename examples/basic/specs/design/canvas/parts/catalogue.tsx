import { CanvasGlyph } from "../../library/canvas/glyphs.js";
import { optional, useDesignInstance } from "../../library/composition.js";
import { floatingPanel } from "../../library/panels/floating-panel.js";
import { NavTree } from "../../parts/nav.js";

import type { CanvasDestination } from "./destinations.js";
import { CANVAS_ALL_ROWS, CANVAS_CHANGES_ROWS } from "./nav_rows.js";

/** The catalogue's filter, and the row of the selected entry. */
export interface CatalogueView {
  filter: "all" | "changes";
  /** The key of the selected entry's row; none with nothing selected. */
  activeKey?: string | undefined;
}

/** The foot of the Changes filter: the base that it compares with. */
function ChangesBase() {
  return (
    <span className="cv-base">
      <CanvasGlyph name="folder-branch" size={14} />
      Compared with <b>origin/main</b>
    </span>
  );
}

/**
 * The floating catalogue: the shipped catalogue navigation in the All or
 * Changes filter, in a floating panel, or in the catalogue sheet of the
 * compact form. Its rows open Canvas artboards only.
 */
export function CanvasCatalogue({
  close,
  sheet,
  view,
}: {
  close?: CanvasDestination | undefined;
  sheet: boolean;
  view: CatalogueView;
}) {
  const changes = view.filter === "changes";
  return (
    <floatingPanel.Component
      moklyInstance={useDesignInstance("catalogue-panel")}
      side="left"
      label="Catalogue"
      sheet={sheet}
      {...optional("closeDestination", sheet ? close : undefined)}
      {...(changes ? { foot: <ChangesBase /> } : {})}
    >
      <NavTree
        activeKey={view.activeKey}
        changedOnly={changes}
        nodes={changes ? CANVAS_CHANGES_ROWS : CANVAS_ALL_ROWS}
      />
    </floatingPanel.Component>
  );
}
