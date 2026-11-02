/** The route-owned display transition shared by both shell roots. */

import type { Catalogue } from "./catalogue.js";
import { disclosurePath } from "./nav_model.js";
import type { NavSectionNode } from "./nav_tree.js";
import type { ShellRoute } from "./routes.js";
import { openDisclosures, type ShellState } from "./store_state.js";
import { viewTitle } from "./view_title.js";

export function installShellRoute(
  state: ShellState,
  route: ShellRoute,
  catalogue: Catalogue,
  sections: readonly NavSectionNode[],
  delivery: "embedded" | "standalone",
): ShellState {
  const path =
    route.view.kind === "target"
      ? disclosurePath(sections, route.view.target.entry.path)
      : [];
  const title =
    route.view.kind !== "target" && delivery === "embedded"
      ? "Mokly"
      : viewTitle(catalogue, route.view);
  return {
    ...state,
    announcement: `Loaded ${title}`,
    comparisonIntent: route.comparison === "side",
    disclosures: openDisclosures(state.disclosures, path),
    drawerOpen: false,
    expandedFrame: undefined,
    filterBaseline: state.filterBaseline
      ? openDisclosures(state.filterBaseline, path)
      : undefined,
    route,
    routeInstallation: state.routeInstallation + 1,
    tagPickerOpen: false,
  };
}
