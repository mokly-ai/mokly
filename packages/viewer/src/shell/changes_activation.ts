/** Changes-filter navigation shared by standalone and embedded shells. */

import type { ViewerSelection } from "../viewer/types.js";

import {
  catalogueSelectionEntry,
  type Catalogue,
  type CatalogueManifestEntry,
} from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { ShellRoute } from "./routes.js";
import { rowMatchesQuery } from "./search_query.js";
import { workspaceData } from "./workspace_data.js";
import { workspaceEvidenceEntry } from "./workspace_entry.js";
import { selectedChangedViews } from "./workspace_views_data.js";

interface ChangedDestination {
  entry: CatalogueManifestEntry;
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
    !context.changedIds ||
    route.view.kind !== "target"
  )
    return route;
  const requested = route.view.target.entry;
  const destination = context.changedIds.includes(requested.id)
    ? {
        entry: requested,
        ...(route.snapshot ? { snapshotId: route.snapshot } : {}),
      }
    : firstVisibleChangedVariant(catalogue, context, selection, requested.id);
  if (!destination) return route;
  const redirected = destination.entry.id !== requested.id;
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
    workspaceEvidenceEntry(data),
    data.changedViews,
    data.variants.find(({ value }) => value.id === destination.entry.id)?.value
      .id ?? data.variants[0]?.value.id,
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
    ? context.changedIds?.includes(current.id) === true
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
    (parent?.kind !== "screen" && parent?.kind !== "component") ||
    ("variantOf" in parent && parent.variantOf !== undefined) ||
    !catalogue.manifest.entries.some((entry) => entry.id === parent.id)
  )
    return;
  const current = (catalogue.hierarchy.variantsById.get(parentId) ?? []).map(
    (entry) => ({ entry }),
  );
  const removed = catalogue.removedEntries.flatMap(({ entry, snapshotId }) =>
    entry.kind === parent.kind &&
    "variantOf" in entry &&
    entry.variantOf === parentId &&
    (snapshotId !== undefined || catalogue.byId.get(entry.id) === entry)
      ? [{ entry, ...(snapshotId ? { snapshotId } : {}) }]
      : [],
  );
  return [...current, ...removed].find(
    ({ entry }) =>
      context.changedIds?.includes(entry.id) &&
      rowMatchesQuery(
        { freeText: selection.search, tags: selection.tags },
        {
          id: entry.id,
          tags: entry.tags ?? [],
          text: catalogue.manifest.entries.some(
            (candidate) => candidate.id === entry.id,
          )
            ? entry.title
            : `${entry.title} · Removed`,
        },
      ),
  );
}
