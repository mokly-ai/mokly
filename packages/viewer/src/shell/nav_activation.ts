/** Changes-filter destinations shared by navigation markup and shell routers. */

import type { ViewerSelection } from "../viewer/types.js";

import { catalogueRouteEntry, type Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { navLeafVisible } from "./nav_model.js";
import type { NavLeafNode } from "./nav_tree.js";
import { workspaceData } from "./workspace_data.js";
import { selectedChangedViews } from "./workspace_views_data.js";

/** Effective row destination and the first changed view selected on arrival. */
export interface NavActivation {
  colorScheme?: "dark" | "light";
  route: string;
  viewport?: "desktop" | "mobile";
}

/** Resolve aggregate-only parents and per-view evidence while Changes is on. */
export function navActivation(
  node: NavLeafNode,
  catalogue: Catalogue,
  context: ShellContext,
  selection: ViewerSelection,
): NavActivation {
  if (selection.view !== "changes") return { route: node.route };
  const destination = context.changedRoutes?.includes(node.route)
    ? node
    : node.variants?.find(
        (variant) =>
          context.changedRoutes?.includes(variant.route) === true &&
          navLeafVisible(variant, selection, context),
      );
  if (!destination) return { route: node.route };
  const entry = catalogueRouteEntry(catalogue, destination.route);
  if (entry?.kind !== "screen" && entry?.kind !== "component")
    return { route: destination.route };
  const data = workspaceData(catalogue, context, entry);
  const variantId =
    entry.kind === "component" ? data.variants[0]?.value.id : undefined;
  const first = selectedChangedViews(entry, data.changedViews, variantId)[0];
  return {
    route: destination.route,
    ...(first
      ? { colorScheme: first.colorScheme, viewport: first.viewport }
      : {}),
  };
}

/** Read the optional ephemeral changed-view selection carried by a row link. */
export function navActivationAxes(
  anchor: Pick<Element, "getAttribute">,
): Pick<NavActivation, "colorScheme" | "viewport"> {
  const viewport = anchor.getAttribute("data-nav-activate-viewport");
  const colorScheme = anchor.getAttribute("data-nav-activate-scheme");
  return {
    ...(viewport === "desktop" || viewport === "mobile" ? { viewport } : {}),
    ...(colorScheme === "dark" || colorScheme === "light"
      ? { colorScheme }
      : {}),
  };
}
