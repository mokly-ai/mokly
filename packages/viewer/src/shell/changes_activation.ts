/** Changes-filter navigation shared by standalone and embedded shells. */

import type { ViewerSelection } from "../viewer/types.js";

import {
  catalogueSelectionEntry,
  type Catalogue,
  type CatalogueManifestEntry,
} from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { catalogueNavSections, navLeafVisible } from "./nav_model.js";
import type { NavLeafNode, NavNode } from "./nav_tree.js";
import type { ShellRoute } from "./routes.js";
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
    !context.changedEntries ||
    route.view.kind !== "target"
  )
    return route;
  const requested = route.view.target.entry;
  const destination = context.changedEntries.includes(requested.path)
    ? {
        entry: requested,
        ...(route.snapshot ? { snapshotId: route.snapshot } : {}),
      }
    : firstVisibleChangedEntry(catalogue, context, selection, requested);
  if (!destination) return route;
  const redirected = destination.entry.path !== requested.path;
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
    data.variants.find(({ value }) => value.path === destination.entry.path)
      ?.value.path ?? data.variants[0]?.value.path,
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
  const current = selection.screenPath
    ? catalogueSelectionEntry(
        catalogue,
        selection.screenPath,
        selection.snapshotId,
      )
    : undefined;
  return current !== undefined
    ? context.changedEntries?.includes(current.path) === true
    : false;
}

/**
 * The first visible changed row an unmodified container row lists, in the
 * built tree's row order: its variants, then the removed variants attached
 * after them, then its folder members, descending into member folders and
 * member lists. Only a current screen or component row lists entries.
 */
function firstVisibleChangedEntry(
  catalogue: Catalogue,
  context: ShellContext,
  selection: ViewerSelection,
  container: CatalogueManifestEntry,
): ChangedDestination | undefined {
  const row = containerRow(
    catalogueNavSections(catalogue).flatMap(({ children }) => children),
    `entry:${container.path}`,
  );
  for (const listed of row ? listedRows(row) : []) {
    if (!navLeafVisible(listed, selection, context)) continue;
    const entry = catalogueSelectionEntry(
      catalogue,
      listed.entryId,
      listed.snapshotId,
    );
    if (entry)
      return {
        entry,
        ...(listed.snapshotId ? { snapshotId: listed.snapshotId } : {}),
      };
  }
  return undefined;
}

/** The row for one current entry, wherever a folder or member list holds it. */
function containerRow(
  nodes: readonly NavNode[],
  key: string,
): NavLeafNode | undefined {
  for (const node of nodes) {
    if (node.kind === "leaf" && node.key === key) return node;
    const found = containerRow(
      node.kind === "group" ? node.children : (node.members ?? []),
      key,
    );
    if (found) return found;
  }
  return undefined;
}

/** The rows a list discloses, in the order the list shows them. */
function listedRows(row: NavLeafNode): NavLeafNode[] {
  return [...(row.variants ?? []), ...(row.members ?? []).flatMap(memberRows)];
}

/** A member row followed by everything its folder or list holds. */
function memberRows(node: NavNode): NavLeafNode[] {
  return node.kind === "group"
    ? node.children.flatMap(memberRows)
    : [node, ...listedRows(node)];
}
