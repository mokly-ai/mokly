/** Atomic filtering and active-route disclosure transitions. */

import type { ViewerSelection } from "../host/types.js";
import { folderTitleLookup } from "../registry/folder_titles.js";

import type { Catalogue } from "./catalogue.js";
import { navigationFiltering } from "./nav_model.js";
import type { NavSectionNode } from "./nav_tree.js";
import type { ShellRoute } from "./routes.js";
import { routeScreenId } from "./routes.js";
import { revealSelection, sameQuery, selectionQuery } from "./selection.js";
import { installShellRoute } from "./store_routes.js";
import type { ShellState } from "./store_state.js";

/** Reveal matching groups only when the selection's filters actually change. */
export function withFilterSelection(
  state: ShellState,
  selection: ViewerSelection,
): ShellState {
  const filtersChanged =
    !sameQuery(state.selection, selection) ||
    state.selection.view !== selection.view;
  return withSelection(state, selection, filtersChanged);
}

/** Install a route, revealing only the destination path and hidden constraints. */
export function withRoute(
  state: ShellState,
  route: ShellRoute,
  catalogue: Catalogue,
  sections: readonly NavSectionNode[],
): ShellState {
  let selection = { ...state.selection, screenPath: routeScreenId(route) };
  if (route.snapshot) selection.snapshotId = route.snapshot;
  else delete selection.snapshotId;
  if (route.viewport) selection.viewport = route.viewport;
  selection = revealSelection(
    catalogue.publicModel,
    folderTitleLookup(catalogue.hierarchy),
    selection,
  );
  return installShellRoute(
    withSelection(state, selection, false),
    route,
    catalogue,
    sections,
    "standalone",
  );
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
  const query = sameQuery(state.selection, selection)
    ? state.query
    : selectionQuery(selection);
  return {
    ...state,
    disclosures,
    filterBaseline: baseline,
    query,
    selection,
  };
}
