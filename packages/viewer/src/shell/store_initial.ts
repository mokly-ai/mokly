/** Deterministic shell-state initialization shared by SSR and hydration. */

import { resolveCatalogueRoute } from "../catalogue/entry_selection.js";
import { defaultSelection } from "../viewer/selection.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { reconcileDisclosures } from "./disclosure_storage.js";
import {
  catalogueNavSections,
  defaultDisclosures,
  disclosurePath,
  navigationFiltering,
} from "./nav_model.js";
import { routeScreenId, type ShellRoute } from "./routes.js";
import { parseSearchQuery } from "./search_query.js";
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
  view: ShellView,
  initial: ShellInitialState | undefined,
): ShellState {
  const recovery = initial?.recovery;
  const snapshotId =
    context.snapshotId ??
    (context.readModel && view.kind === "target"
      ? resolveCatalogueRoute(context.readModel, view.target.entry.route)
          ?.snapshotId
      : undefined);
  const route: ShellRoute = {
    view,
    ...(context.fragment ? { fragment: context.fragment } : {}),
    ...(snapshotId ? { snapshot: snapshotId } : {}),
  };
  const sections = catalogueNavSections(catalogue);
  const defaults = defaultDisclosures(sections, context.activeRoute);
  const parsed = parseSearchQuery(recovery?.query ?? "");
  const selection = {
    ...defaultSelection,
    screenId: routeScreenId(route),
    ...(route.snapshot ? { snapshotId: route.snapshot } : {}),
    view: recovery?.view ?? "all",
    viewport: recovery?.viewport ?? "both",
    colorScheme:
      catalogue.hasDarkFragments &&
      (initial?.colorScheme ?? recovery?.colorScheme) === "dark"
        ? ("dark" as const)
        : ("light" as const),
    search: parsed.freeText,
    tags: parsed.tags,
  };
  let disclosures = defaults;
  if (initial?.disclosures)
    disclosures = reconcileDisclosures(
      defaults,
      initial.disclosures,
      "default",
    );
  if (recovery)
    disclosures = reconcileDisclosures(
      defaults,
      recovery.disclosures,
      navigationFiltering(selection) ? "open" : "default",
    );
  let filterBaseline = recovery?.filterBaselineDisclosures
    ? reconcileDisclosures(
        defaults,
        recovery.filterBaselineDisclosures,
        "default",
      )
    : undefined;
  if (route.view.kind === "target") {
    const activePath = disclosurePath(sections, route.view.target.entry.route);
    disclosures = openDisclosures(disclosures, activePath);
    if (filterBaseline)
      filterBaseline = openDisclosures(filterBaseline, activePath);
  }
  if (initial?.earlyDisclosures)
    disclosures = reconcileDisclosures(
      defaults,
      { ...disclosures, ...initial.earlyDisclosures },
      "default",
    );
  const componentDefault =
    route.view.kind === "target" &&
    route.view.target.entry.kind === "component";
  const detailsOpen =
    initial?.earlyDetailsOpen ??
    recovery?.detailsOpen ??
    initial?.detailsOpen ??
    componentDefault;
  return {
    announcement: "",
    changesStatus: recovery?.changesStatus ?? context.changesStatus,
    detailsOpen,
    disclosures,
    drawerOpen: recovery?.drawerOpen ?? false,
    expandedFrame: undefined,
    filterBaseline,
    inspectorTab: detailsOpen ? "details" : undefined,
    navigationMaximum: initial?.navigationMaximum ?? 480,
    navigationWidth: initial?.navigationWidth ?? 248,
    navScroll: recovery?.navScroll ?? 0,
    query: recovery?.query ?? "",
    regionScrolls: recovery?.regionScrolls ?? {},
    route,
    selection,
    tagPickerIndex: 0,
    tagPickerOpen: false,
  };
}
