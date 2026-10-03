/** Pure navigation-tree state used by SSR and the hydrated shell. */

import type { ViewerSelection } from "../viewer/types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { folderDisclosureKey } from "./disclosure_keys.js";
import { buildNavSections } from "./nav_tree.js";
import type { NavLeafNode, NavNode, NavSectionNode } from "./nav_tree.js";
import { queryConstrains, rowMatchesQuery } from "./search_query.js";

/** Build the complete current-and-removed tree displayed in the rail. */
export function catalogueNavSections(
  catalogue: Catalogue,
): readonly NavSectionNode[] {
  const removed: NavLeafNode[] = catalogue.removedEntries.flatMap(
    ({ entry, snapshotId }) => {
      const variantOf =
        (entry.kind === "screen" || entry.kind === "component") &&
        "variantOf" in entry
          ? entry.variantOf
          : undefined;
      return [
        {
          kind: "leaf",
          key: `removed:${entry.path}`,
          entryId: entry.path,
          entryKind: entry.kind,
          label: `${entry.title} · Removed`,
          tags: entry.tags ?? [],
          removedPage: entry.kind === "page",
          ...(snapshotId ? { snapshotId } : {}),
          ...(variantOf === undefined ? {} : { variantOf }),
        },
      ];
    },
  );
  return buildNavSections(catalogue.hierarchy, removed);
}

/** Initial disclosure values rendered on the server for one active route. */
export function defaultDisclosures(
  sections: readonly NavSectionNode[],
  activeId: string | undefined,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const section of sections) {
    result[section.key] = true;
    collectDefaults(section.children, section.id, activeId, 0, result);
  }
  return result;
}

/** Disclosure identities that must open to expose one routed row. */
export function disclosurePath(
  sections: readonly NavSectionNode[],
  id: string,
): readonly string[] {
  for (const section of sections) {
    const descendants = nodePath(section.children, section.id, id);
    if (descendants) return [section.key, ...descendants];
  }
  return [];
}

/** Whether one leaf survives the current search and Changes constraints. */
export function navLeafVisible(
  leaf: NavLeafNode,
  selection: Pick<ViewerSelection, "view" | "search" | "tags">,
  context: ShellContext,
): boolean {
  const status = context.changedEntries ? "ready" : context.changesStatus;
  if (selection.view === "changes" && status !== "ready") return false;
  if (selection.view !== "changes" && leaf.hidden) return false;
  if (
    selection.view === "changes"
      ? !context.changedEntries?.includes(leaf.entryId)
      : leaf.removedPage || leaf.removedVariant
  )
    return false;
  return rowMatchesQuery(
    { freeText: selection.search, tags: selection.tags },
    {
      id: leaf.entryId,
      tags: leaf.tags ?? [],
      text: leaf.label,
    },
  );
}

/** Whether a group should remain in the filtered tree. */
export function navNodeVisible(
  node: NavNode,
  selection: Pick<ViewerSelection, "view" | "search" | "tags">,
  context: ShellContext,
): boolean {
  if (selection.view !== "changes" && node.hidden) return false;
  if (node.kind === "leaf")
    return (
      navLeafVisible(node, selection, context) ||
      (node.variants ?? []).some((variant) =>
        navLeafVisible(variant, selection, context),
      )
    );
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
  id: string | undefined,
  depth: number,
  result: Record<string, boolean>,
): void {
  for (const node of nodes) {
    if (node.kind === "leaf") {
      if (node.variants?.length)
        result[variantDisclosureKey(node.entryId)] = containsEntryId(node, id);
      continue;
    }
    result[folderDisclosureKey(section, node.key)] =
      depth === 0 || containsEntryId(node, id);
    collectDefaults(node.children, section, id, depth + 1, result);
  }
}

function nodePath(
  nodes: readonly NavNode[],
  section: NavSectionNode["id"],
  id: string,
): string[] | undefined {
  for (const node of nodes) {
    if (node.kind === "leaf") {
      if (node.entryId === id)
        return node.variants?.length
          ? [variantDisclosureKey(node.entryId)]
          : [];
      if (node.variants?.some((variant) => variant.entryId === id))
        return [variantDisclosureKey(node.entryId)];
      continue;
    }
    const child = nodePath(node.children, section, id);
    if (child) return [folderDisclosureKey(section, node.key), ...child];
  }
  return undefined;
}

function containsEntryId(node: NavNode, id: string | undefined): boolean {
  return (
    id !== undefined &&
    (node.kind === "leaf"
      ? node.entryId === id ||
        (node.variants ?? []).some((variant) => variant.entryId === id)
      : node.children.some((child) => containsEntryId(child, id)))
  );
}

/** Persisted disclosure identity for one screen's variant list. */
export function variantDisclosureKey(parentId: string): string {
  return `variants:${parentId}`;
}
