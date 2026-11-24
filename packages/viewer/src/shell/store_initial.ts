/** Deterministic shell-state initialization from a route and stored preferences. */

import { resolveCatalogueEntry } from "../catalogue/entry_selection.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { reconcileDisclosures } from "./disclosure_storage.js";
import { BOTH_SCHEMES } from "./frames_filter.js";
import {
  catalogueNavSections,
  defaultDisclosures,
  disclosurePath,
} from "./nav_model.js";
import { routeScreenId, type ShellRoute } from "./routes.js";
import { defaultSelection } from "./selection.js";
import {
  openDisclosures,
  type ShellInitialState,
  type ShellState,
} from "./store_state.js";
import type { ShellView } from "./views.js";

/** Construct the first state without reading ambient browser globals. */
export function createInitialShellState(
  catalogue: Catalogue,
  context: ShellContext,
  route: ShellRoute,
  initial: ShellInitialState | undefined,
): ShellState {
  const sections = catalogueNavSections(catalogue);
  const activeId = routeScreenId(route) ?? undefined;
  const defaults = defaultDisclosures(sections, activeId);
  const selection = {
    ...defaultSelection,
    screenPath: routeScreenId(route),
    ...(route.snapshot ? { snapshotId: route.snapshot } : {}),
    ...(route.viewport ? { viewport: route.viewport } : {}),
    colorScheme:
      catalogue.hasDarkFragments && initial?.colorScheme === "dark"
        ? ("dark" as const)
        : ("light" as const),
  };
  let disclosures = initial?.disclosures
    ? reconcileDisclosures(defaults, initial.disclosures, "default")
    : defaults;
  if (route.view.kind === "target")
    disclosures = openDisclosures(
      disclosures,
      disclosurePath(sections, route.view.target.entry.path),
    );
  return {
    announcement: "",
    changesStatus: context.changesStatus,
    comparisonIntent: route.comparison === "side",
    disclosures,
    filterBaseline: undefined,
    frames: BOTH_SCHEMES,
    navigationMaximum: initial?.navigationMaximum ?? 480,
    navigationWidth: initial?.navigationWidth,
    navScroll: 0,
    panelTab: "inspect",
    query: "",
    revealedFolder: undefined,
    route,
    routeInstallation: 0,
    selection,
    sheet: undefined,
    sheetExpanded: false,
    tagPickerIndex: 0,
    tagPickerOpen: false,
  };
}

/** The first route of a view resolved without a URL: no fragment or axes. */
export function viewRoute(
  catalogue: Catalogue,
  view: ShellView,
  snapshotId?: string,
): ShellRoute {
  const snapshot =
    snapshotId ??
    (view.kind === "target"
      ? resolveCatalogueEntry(catalogue.publicModel, {
          path: view.target.entry.path,
          kind: view.target.entry.kind,
        })?.snapshotId
      : undefined);
  return { view, ...(snapshot ? { snapshot } : {}) };
}
