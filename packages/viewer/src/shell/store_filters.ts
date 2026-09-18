/** Atomic filtering and active-route disclosure transitions. */

import { revealSelection } from "../viewer/selection.js";
import type { ViewerSelection } from "../viewer/types.js";

import type { Catalogue } from "./catalogue.js";
import { disclosurePath, navigationFiltering } from "./nav_model.js";
import type { NavSectionNode } from "./nav_tree.js";
import type { ShellRoute } from "./routes.js";
import { routeScreenId } from "./routes.js";
import { openDisclosures, type ShellState } from "./store_state.js";

/** Apply a user-authored search or filter and reveal its matching groups. */
export function withFilterSelection(
  state: ShellState,
  selection: ViewerSelection,
): ShellState {
  return withSelection(state, selection, true);
}

/** Install a route, revealing only the destination path and hidden constraints. */
export function withRoute(
  state: ShellState,
  route: ShellRoute,
  catalogue: Catalogue,
  sections: readonly NavSectionNode[],
): ShellState {
  let selection = { ...state.selection, screenId: routeScreenId(route) };
  if (catalogue.publicModel)
    selection = revealSelection(catalogue.publicModel, selection);
  let next = withSelection(state, selection, false);
  if (route.view.kind === "target") {
    const path = disclosurePath(sections, route.view.target.entry.route);
    next = {
      ...next,
      disclosures: openDisclosures(next.disclosures, path),
      filterBaseline: next.filterBaseline
        ? openDisclosures(next.filterBaseline, path)
        : undefined,
    };
  }
  return {
    ...next,
    announcement: `Loaded ${routeTitle(catalogue, route)}`,
    drawerOpen: false,
    expandedFrame: undefined,
    route,
    selection,
    tagPickerOpen: false,
  };
}

function withSelection(
  state: ShellState,
  selection: ViewerSelection,
  revealMatches: boolean,
): ShellState {
  const filteredBefore = navigationFiltering(state.selection);
  const filteredAfter = navigationFiltering(selection);
  let disclosures = { ...state.disclosures };
  let baseline = state.filterBaseline;
  if (!filteredBefore && filteredAfter) baseline = disclosures;
  if (filteredAfter && revealMatches)
    disclosures = Object.fromEntries(
      Object.keys(disclosures).map((key) => [key, true]),
    );
  if (filteredBefore && !filteredAfter) {
    disclosures = { ...(baseline ?? disclosures) };
    baseline = undefined;
  }
  return { ...state, disclosures, filterBaseline: baseline, selection };
}

function routeTitle(catalogue: Catalogue, route: ShellRoute): string {
  if (route.view.kind === "home") return "Mokly";
  if (route.view.kind === "missing") return "Not found · Mokly";
  const entry = catalogue.byId.get(route.view.target.entry.id);
  return `${entry?.title ?? route.view.target.entry.title} · Mokly`;
}
