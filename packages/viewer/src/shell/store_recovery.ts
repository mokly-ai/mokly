/** Persistable shell state shared by standalone reload and embedded hosts. */
import { decodeDisclosureMap } from "./disclosure_storage.js";
import type { ShellStore } from "./store_context.js";
import { captureScrolls } from "./store_scroll.js";
import type { ShellState } from "./store_state.js";

/** Capture reload state without assuming that this shell owns the document. */
export function shellRecoverySnapshot(
  state: ShellState,
  interactive: boolean,
): ReturnType<ShellStore["recoverySnapshot"]> {
  const regionScrolls =
    interactive && typeof document !== "undefined"
      ? captureScrolls(document)
      : state.regionScrolls;
  return {
    ...(state.changesStatus ? { changesStatus: state.changesStatus } : {}),
    disclosures: decodeDisclosureMap(state.disclosures),
    colorScheme: state.selection.colorScheme,
    detailsOpen: state.detailsOpen,
    drawerOpen: state.drawerOpen,
    filterBaselineDisclosures: state.filterBaseline
      ? decodeDisclosureMap(state.filterBaseline)
      : null,
    navScroll: state.navScroll,
    previewMode: state.previewMode,
    query: state.query,
    regionScrolls,
    view: state.selection.view,
    viewport: state.selection.viewport,
  };
}
