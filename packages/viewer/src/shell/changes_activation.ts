/** Changes-filter navigation shared by standalone and embedded shells. */

import type { ViewerSelection } from "../viewer/types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { ShellRoute } from "./routes.js";
import { rowMatchesQuery } from "./search_query.js";
import type { RoutedEntry } from "./target.js";
import { workspaceData } from "./workspace_data.js";
import { selectedChangedViews } from "./workspace_views_data.js";

/** Apply the destination and view-axis rules for a visible Changes row. */
export function changesActivation(
  catalogue: Catalogue,
  context: ShellContext,
  selection: ViewerSelection,
  route: ShellRoute,
): ShellRoute {
  if (
    selection.view !== "changes" ||
    !context.changedRoutes ||
    route.view.kind !== "target"
  )
    return route;
  const requested = route.view.target.entry;
  const destination = context.changedRoutes.includes(requested.route)
    ? requested
    : firstVisibleChangedVariant(catalogue, context, selection, requested.id);
  if (!destination) return route;
  const redirected = destination.route !== requested.route;
  const next: ShellRoute = redirected
    ? {
        ...route,
        view: {
          kind: "target",
          target: { kind: "entry", entry: destination },
        },
      }
    : route;
  if (
    route.viewport !== undefined ||
    route.colorScheme !== undefined ||
    (destination.kind !== "screen" && destination.kind !== "component")
  )
    return next;
  const data = workspaceData(catalogue, context, destination);
  const first = selectedChangedViews(
    destination,
    data.changedViews,
    data.variants[0]?.value.id,
  )[0];
  return first
    ? { ...next, viewport: first.viewport, colorScheme: first.colorScheme }
    : next;
}

function firstVisibleChangedVariant(
  catalogue: Catalogue,
  context: ShellContext,
  selection: ViewerSelection,
  parentId: string,
): RoutedEntry | undefined {
  const parent = catalogue.hierarchy.byId.get(parentId);
  if (
    parent?.kind !== "screen" ||
    parent.variantOf !== undefined ||
    !catalogue.byRoute.has(parent.route)
  )
    return;
  const current = (
    catalogue.hierarchy.variantsById.get(parentId) ?? []
  ).flatMap((entry): RoutedEntry[] =>
    entry.kind === "collection" ? [] : [entry],
  );
  const removed = catalogue.removedEntries.flatMap(({ entry }) =>
    entry.kind === "screen" && entry.variantOf === parentId ? [entry] : [],
  );
  return [...current, ...removed].find(
    (entry) =>
      context.changedRoutes?.includes(entry.route) &&
      rowMatchesQuery(
        { freeText: selection.search, tags: selection.tags },
        {
          id: entry.id,
          route: entry.route,
          tags: entry.tags ?? [],
          text: catalogue.byRoute.has(entry.route)
            ? entry.title
            : `${entry.title} · Removed`,
        },
      ),
  );
}
