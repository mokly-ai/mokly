/** Pure navigation-tree state used by SSR and the hydrated shell. */

import type { ViewerSelection } from "../viewer/types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { buildNavSections } from "./nav_tree.js";
import type { NavLeafNode, NavNode, NavSectionNode } from "./nav_tree.js";
import { queryConstrains, rowMatchesQuery } from "./search_query.js";

/** Build the complete current-and-removed tree displayed in the rail. */
export function catalogueNavSections(
  catalogue: Catalogue,
): readonly NavSectionNode[] {
  const removed: NavLeafNode[] = catalogue.removedEntries.map(({ entry }) => ({
    kind: "leaf",
    key: `removed:${entry.route}`,
    entryId: entry.id,
    entryKind: entry.kind,
    label: `${entry.title} · Removed`,
    route: entry.route,
    tags: entry.tags ?? [],
    removedPage: entry.kind === "page",
  }));
  return buildNavSections(catalogue.hierarchy, removed);
}

/** Initial disclosure values rendered on the server for one active route. */
export function defaultDisclosures(
  sections: readonly NavSectionNode[],
  activeRoute: string | undefined,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const section of sections) {
    result[section.key] = true;
    collectDefaults(section.children, section.id, activeRoute, 0, result);
  }
  return result;
}

/** Disclosure identities that must open to expose one routed row. */
export function disclosurePath(
  sections: readonly NavSectionNode[],
  route: string,
): readonly string[] {
  for (const section of sections) {
    const descendants = nodePath(section.children, section.id, route);
    if (descendants) return [section.key, ...descendants];
  }
  return [];
}

/** Whether one leaf survives the current search and Changes constraints. */
export function navLeafVisible(
  leaf: NavLeafNode,
  selection: ViewerSelection,
  context: ShellContext,
): boolean {
  const status = context.changedRoutes ? "ready" : context.changesStatus;
  if (selection.view === "changes" && status !== "ready") return false;
  if (
    selection.view === "changes"
      ? !context.changedRoutes?.includes(leaf.route)
      : leaf.removedPage
  )
    return false;
  return rowMatchesQuery(
    { freeText: selection.search, tags: selection.tags },
    {
      ...(leaf.entryId ? { id: leaf.entryId } : {}),
      route: leaf.route,
      tags: leaf.tags ?? [],
      text: leaf.label,
    },
  );
}

/** Whether a group should remain in the filtered tree. */
export function navNodeVisible(
  node: NavNode,
  selection: ViewerSelection,
  context: ShellContext,
): boolean {
  if (node.kind === "leaf") return navLeafVisible(node, selection, context);
  if (!navigationFiltering(selection)) return true;
  return node.children.some((child) =>
    navNodeVisible(child, selection, context),
  );
}

/** Whether search or Changes filtering currently constrains the tree. */
export function navigationFiltering(selection: ViewerSelection): boolean {
  return (
    selection.view === "changes" ||
    queryConstrains({ freeText: selection.search, tags: selection.tags })
  );
}

function collectDefaults(
  nodes: readonly NavNode[],
  section: NavSectionNode["id"],
  route: string | undefined,
  depth: number,
  result: Record<string, boolean>,
): void {
  for (const node of nodes) {
    if (node.kind === "leaf") continue;
    result[collectionKey(section, node.key)] =
      depth === 0 || containsRoute(node, route);
    collectDefaults(node.children, section, route, depth + 1, result);
  }
}

function nodePath(
  nodes: readonly NavNode[],
  section: NavSectionNode["id"],
  route: string,
): string[] | undefined {
  for (const node of nodes) {
    if (node.kind === "leaf") {
      if (node.route === route) return [];
      continue;
    }
    const child = nodePath(node.children, section, route);
    if (child) return [collectionKey(section, node.key), ...child];
  }
  return undefined;
}

function containsRoute(node: NavNode, route: string | undefined): boolean {
  return (
    route !== undefined &&
    (node.kind === "leaf"
      ? node.route === route
      : node.children.some((child) => containsRoute(child, route)))
  );
}

function collectionKey(section: NavSectionNode["id"], key: string): string {
  const id = key.startsWith("collection:")
    ? key.slice("collection:".length)
    : key;
  return `collection:${section}:${id}`;
}
