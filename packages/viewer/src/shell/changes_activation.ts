/** Changes-filter navigation shared by standalone and embedded shells. */

import { folderTitlesAt } from "../registry/folder_titles.js";
import type { HierarchyLeaf, HierarchyNode } from "../registry/hierarchy.js";
import type { ManifestEntry } from "../registry/types.js";
import type { ViewerSelection } from "../viewer/types.js";

import {
  catalogueSelectionEntry,
  type Catalogue,
  type CatalogueManifestEntry,
} from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { ShellRoute } from "./routes.js";
import { rowMatchesQuery, searchRow } from "./search_query.js";
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
    : firstVisibleChangedEntry(catalogue, context, selection, requested.path);
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
 * The first visible changed entry an unmodified container row lists, in list
 * order: its variants, retained removed variants after them, then its folder
 * members, descending into member folders and member lists.
 */
function firstVisibleChangedEntry(
  catalogue: Catalogue,
  context: ShellContext,
  selection: ViewerSelection,
  parentId: string,
): ChangedDestination | undefined {
  const parent = catalogue.hierarchy.byPath.get(parentId);
  if (
    (parent?.kind !== "screen" && parent?.kind !== "component") ||
    ("variantOf" in parent && parent.variantOf !== undefined) ||
    !catalogue.manifest.entries.some((entry) => entry.path === parent.path)
  )
    return;
  const roots =
    parent.kind === "component"
      ? catalogue.hierarchy.roots.components
      : catalogue.hierarchy.roots.specs;
  const node = entryNode(roots, parentId);
  const listed = node
    ? entryList(catalogue, node)
    : [
        ...(catalogue.hierarchy.variantsByPath.get(parentId) ?? []).map(
          (entry) => ({ entry }),
        ),
        ...removedVariants(catalogue, parent),
      ];
  return listed.find(
    ({ entry }) =>
      context.changedEntries?.includes(entry.path) &&
      rowMatchesQuery(
        { freeText: selection.search, tags: selection.tags },
        searchRow(entry, folderTitlesAt(catalogue.hierarchy, entry.path)),
      ),
  );
}

/** One section's row for an entry path, wherever it is listed. */
function entryNode(
  nodes: readonly HierarchyNode<ManifestEntry>[],
  path: string,
): HierarchyLeaf<ManifestEntry> | undefined {
  for (const node of nodes) {
    if (node.kind === "entry" && node.key === path) return node;
    const found = entryNode(node.children ?? [], path);
    if (found) return found;
  }
  return undefined;
}

/** The entries an entry row's list holds, in the order the list shows them. */
function entryList(
  catalogue: Catalogue,
  node: HierarchyLeaf<ManifestEntry>,
): ChangedDestination[] {
  const children = node.children ?? [];
  const variant = (child: HierarchyNode<ManifestEntry>) =>
    child.kind === "entry" &&
    "variantOf" in child.entry &&
    child.entry.variantOf === node.entry.path;
  return [
    ...children.flatMap((child) =>
      child.kind === "entry" && variant(child) ? [{ entry: child.entry }] : [],
    ),
    ...removedVariants(catalogue, node.entry),
    ...children
      .filter((child) => !variant(child))
      .flatMap((child) => listedRows(catalogue, child)),
  ];
}

/** A member row followed by everything its folder or list holds. */
function listedRows(
  catalogue: Catalogue,
  node: HierarchyNode<ManifestEntry>,
): ChangedDestination[] {
  return node.kind === "folder"
    ? node.children.flatMap((child) => listedRows(catalogue, child))
    : [{ entry: node.entry }, ...entryList(catalogue, node)];
}

/** Retained baseline variants that a surviving entry still lists. */
function removedVariants(
  catalogue: Catalogue,
  parent: CatalogueManifestEntry,
): ChangedDestination[] {
  return catalogue.removedEntries.flatMap(({ entry, snapshotId }) =>
    entry.kind === parent.kind &&
    "variantOf" in entry &&
    entry.variantOf === parent.path
      ? [{ entry, ...(snapshotId ? { snapshotId } : {}) }]
      : [],
  );
}
