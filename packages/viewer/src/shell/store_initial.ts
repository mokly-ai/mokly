/** Deterministic shell-state initialization shared by SSR and hydration. */

import { defaultSelection } from "../viewer/selection.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import {
  catalogueNavSections,
  defaultDisclosures,
  disclosurePath,
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
  const route: ShellRoute = {
    view,
    ...(context.fragment ? { fragment: context.fragment } : {}),
  };
  const sections = catalogueNavSections(catalogue);
  let disclosures = defaultDisclosures(sections, context.activeRoute);
  if (initial?.disclosures)
    disclosures = { ...disclosures, ...initial.disclosures };
  if (recovery)
    disclosures = disclosuresFromClosed(
      disclosures,
      recovery.closedCollectionIds,
    );
  let filterBaseline = recovery?.filterBaselineClosedCollectionIds
    ? disclosuresFromClosed(
        defaultDisclosures(sections, context.activeRoute),
        recovery.filterBaselineClosedCollectionIds,
      )
    : undefined;
  if (route.view.kind === "target") {
    const activePath = disclosurePath(sections, route.view.target.entry.route);
    disclosures = openDisclosures(disclosures, activePath);
    if (filterBaseline)
      filterBaseline = openDisclosures(filterBaseline, activePath);
  }
  if (initial?.earlyDisclosures)
    disclosures = { ...disclosures, ...initial.earlyDisclosures };
  const parsed = parseSearchQuery(recovery?.query ?? "");
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
    selection: {
      ...defaultSelection,
      screenId: routeScreenId(route),
      view: recovery?.view ?? "all",
      viewport: recovery?.viewport ?? "both",
      colorScheme:
        catalogue.hasDarkFragments &&
        (initial?.colorScheme ?? recovery?.colorScheme) === "dark"
          ? "dark"
          : "light",
      search: parsed.freeText,
      tags: parsed.tags,
    },
    tagPickerIndex: 0,
    tagPickerOpen: false,
  };
}

function disclosuresFromClosed(
  defaults: Readonly<Record<string, boolean>>,
  closed: readonly string[],
): Record<string, boolean> {
  const values = { ...defaults };
  const keys = new Set(closed);
  for (const key of Object.keys(values)) {
    const legacy = legacyDisclosureKey(key);
    values[key] = !keys.has(key) && !(legacy && keys.has(legacy));
  }
  return values;
}

function legacyDisclosureKey(key: string): string | undefined {
  for (const prefix of ["collection:pages:", "collection:components:"])
    if (key.startsWith(prefix)) return `collection:${key.slice(prefix.length)}`;
  return undefined;
}
