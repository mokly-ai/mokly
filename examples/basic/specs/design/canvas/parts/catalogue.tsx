import { CanvasGlyph } from "../../library/canvas/glyphs.js";
import { optional, useDesignInstance } from "../../library/composition.js";
import { floatingPanel } from "../../library/panels/floating-panel.js";
import { NavTree, type ChangesStatus, type NavNode } from "../../parts/nav.js";

import type { CanvasDestination } from "./destinations.js";
import { CANVAS_ALL_ROWS, CANVAS_CHANGES_ROWS, retarget } from "./nav_rows.js";

/** The catalogue's filter, and the row of the selected entry. */
export interface CatalogueView {
  filter: "all" | "changes";
  /** The key of the selected entry's row; none with nothing selected. */
  activeKey?: string | undefined;
  /**
   * The artboards that other rows open where they differ from the rows'
   * own, by the row's key: on the Changes tab, a changed entry's row keeps
   * the tab.
   */
  targets?: Readonly<Record<string, CanvasDestination>> | undefined;
  /**
   * The rows that the filter draws instead of the canonical branch's rows,
   * such as a catalogue that a tag filters.
   */
  rows?: readonly NavNode[] | undefined;
  /** The Changes filter's availability, while the comparison is not ready. */
  changesStatus?: ChangesStatus | undefined;
  /** The count beside the Changes filter; the canonical branch's by default. */
  changedCount?: number | undefined;
  /** False for a catalogue without comparison data, which has no Changes filter. */
  showChanges?: boolean | undefined;
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
 * compact form. Its rows open Canvas artboards only. The shipped tree marks
 * the selected row as the current page, so that row opens the artboard that
 * renders the catalogue.
 */
export function CanvasCatalogue({
  close,
  design,
  sheet,
  view,
}: {
  close?: CanvasDestination | undefined;
  /** The artboard that renders the catalogue. */
  design: CanvasDestination;
  sheet: boolean;
  view: CatalogueView;
}) {
  const changes = view.filter === "changes";
  const rows = view.rows ?? (changes ? CANVAS_CHANGES_ROWS : CANVAS_ALL_ROWS);
  const { activeKey, targets = {} } = view;
  const target = (key: string) => (key === activeKey ? design : targets[key]);
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
        activeKey={activeKey}
        changedOnly={changes}
        changes={view.showChanges}
        changesStatus={view.changesStatus}
        changedCount={view.changedCount}
        nodes={rows.map((row) => {
          const to = target(row.key);
          return to === undefined ? row : retarget(row, to);
        })}
      />
    </floatingPanel.Component>
  );
}
