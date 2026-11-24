/**
 * The sheets and the dock of the compact layout. The store holds which sheet
 * is open, one at a time, and whether it is expanded. The dock opens a sheet
 * and hides while one is open; a sheet's close control then returns focus to
 * the dock's control that opens it. `@mokly/ui/floating-panel` draws each
 * sheet and `@mokly/ui/canvas-dock` the dock, which names the right panel's
 * selected tab.
 */

import { useMemo } from "react";

import { CanvasDock } from "@mokly/ui/canvas-dock";
import type { FloatingPanelSheet } from "@mokly/ui/floating-panel";

import { useNavigationWidth } from "./nav_resize.js";
import { useShellRoot, useShownCanvas } from "./root_context.js";
import { useLatestShellStore, useShellStore } from "./store_context.js";
import type { ShellSheet } from "./store_state.js";

/**
 * The Canvas layout's parts of a root: the catalogue's sheet, the dock, and
 * the catalogue's width, which the floating catalogue and the canvas's
 * start inset follow.
 */
export function useCanvasLayoutParts() {
  const store = useShellStore();
  return {
    catalogueSheet: useSheet("catalogue"),
    dock: <ShellDock />,
    drawerOpen: store.state.sheet === "catalogue",
    navigationWidth: useNavigationWidth(),
  };
}

/** The state of one sheet, and its actions on the store. */
function useSheet(sheet: ShellSheet): FloatingPanelSheet {
  const store = useShellStore();
  const elements = useShellRoot()?.elements;
  const open = store.state.sheet === sheet;
  return {
    expanded: open && store.state.sheetExpanded,
    onClose: () => {
      store.setSheet(undefined);
      // The dock shows again once the sheet closes, after this render.
      if (typeof requestAnimationFrame !== "function") return;
      requestAnimationFrame(() =>
        elements?.dock
          .ref(sheet === "catalogue" ? "catalogue" : "tab")
          .current?.focus(),
      );
    },
    onExpandedChange: (expanded) => store.setSheetExpanded(expanded),
    open,
  };
}

/** The state of the right panel's sheet, and its actions on the store. */
export function usePanelSheet(): FloatingPanelSheet {
  return useSheet("panel");
}

/**
 * The dock: Catalogue, the right panel's current tab while an entry is
 * selected, and Fit while the canvas holds a section, also during a compare.
 * It hides while a sheet is open.
 */
function ShellDock() {
  const store = useShellStore();
  const latest = useLatestShellStore(store);
  const elements = useShellRoot()?.elements;
  const canvas = useShownCanvas()?.handle;
  const hidden = store.state.sheet !== undefined;
  const tab =
    store.state.route.view.kind === "target" ? store.state.panelTab : undefined;
  return useMemo(
    () =>
      hidden ? null : (
        <CanvasDock
          catalogueRef={elements?.dock.ref("catalogue")}
          onCatalogue={() => latest.current.setSheet("catalogue")}
          onFit={canvas ? () => canvas.fit() : undefined}
          onTab={() => latest.current.setSheet("panel")}
          tab={tab}
          tabRef={elements?.dock.ref("tab")}
        />
      ),
    [canvas, elements, hidden, latest, tab],
  );
}
