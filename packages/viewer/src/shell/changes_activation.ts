/** Changes-filter navigation shared by standalone and embedded shells. */

import type { ViewerSelection } from "../viewer/types.js";

import { catalogueSelectionEntry, type Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { ShellRoute } from "./routes.js";
import { rowMatchesQuery } from "./search_query.js";
import type { RoutedEntry } from "./target.js";
import { workspaceData } from "./workspace_data.js";
import { selectedChangedViews } from "./workspace_views_data.js";

interface ChangedDestination {
  entry: RoutedEntry;
  snapshotId?: string;
}

/** Apply the destination and first-arrival view rules for a visible Changes row. */
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
    ? {
        entry: requested,
        ...(route.snapshot ? { snapshotId: route.snapshot } : {}),
      }
    : firstVisibleChangedVariant(catalogue, context, selection, requested.id);
  if (!destination) return route;
  const redirected = destination.entry.route !== requested.route;
  const next: ShellRoute = redirected
    ? {
        ...route,
        view: {
          kind: "target",
          target: { kind: "entry", entry: destination.entry },
        },
      }
    : route;
  if (redirected) {
    if (destination.snapshotId) next.snapshot = destination.snapshotId;
    else delete next.snapshot;
  }
  if (
    selectionHasChangedRoute(catalogue, context, selection) ||
    route.viewport !== undefined ||
    route.colorScheme !== undefined ||
    (destination.entry.kind !== "screen" &&
      destination.entry.kind !== "component")
  )
    return next;
  const data = workspaceData(catalogue, context, destination.entry);
  const first = selectedChangedViews(
    destination.entry,
    data.changedViews,
    data.variants[0]?.value.id,
  )[0];
  return first
    ? { ...next, viewport: first.viewport, colorScheme: first.colorScheme }
    : next;
}

function selectionHasChangedRoute(
  catalogue: Catalogue,
  context: ShellContext,
  selection: ViewerSelection,
): boolean {
  const current = selection.screenId
    ? catalogueSelectionEntry(
        catalogue,
        selection.screenId,
        selection.snapshotId,
      )
    : undefined;
  return current !== undefined
    ? context.changedRoutes?.includes(current.route) === true
    : false;
}

function firstVisibleChangedVariant(
  catalogue: Catalogue,
  context: ShellContext,
  selection: ViewerSelection,
  parentId: string,
): ChangedDestination | undefined {
  const parent = catalogue.hierarchy.byId.get(parentId);
  if (
    parent?.kind !== "screen" ||
    parent.variantOf !== undefined ||
    !catalogue.byRoute.has(parent.route)
  )
    return;
  const current = (catalogue.hierarchy.variantsById.get(parentId) ?? []).map(
    (entry) => ({ entry }),
  );
  const removed = catalogue.removedEntries.flatMap(({ entry, snapshotId }) =>
    entry.kind === "screen" &&
    entry.variantOf === parentId &&
    (snapshotId !== undefined || catalogue.byId.get(entry.id) === entry)
      ? [{ entry, ...(snapshotId ? { snapshotId } : {}) }]
      : [],
  );
  return [...current, ...removed].find(
    ({ entry }) =>
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
