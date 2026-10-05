/** Pure navigation-tree state used by SSR and the hydrated shell. */

import { folderTitlesAt } from "../registry/folder_titles.js";
import type { ViewerSelection } from "../viewer/types.js";

import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import type { ShellContext } from "./context.js";
import { folderDisclosureKey } from "./disclosure_keys.js";
import { withMovedRows } from "./nav_moves.js";
import { buildNavSections } from "./nav_tree.js";
import type { NavLeafNode, NavNode, NavSectionNode } from "./nav_tree.js";
import { queryConstrains, rowMatchesQuery, searchRow } from "./search_query.js";

/**
 * Build the complete current-and-removed tree displayed in the rail. A removed
 * variant attaches to the current parent the branch-point lookup resolves for
 * it, so a moved or case-renamed parent keeps its removed siblings, while its
 * record keeps the baseline `variantOf`.
 */
export function catalogueNavSections(
  catalogue: Catalogue,
): readonly NavSectionNode[] {
  const lookup = branchPoints(catalogue);
  const removed: NavLeafNode[] = catalogue.removedEntries.map(
    ({ entry, snapshotId }) => {
      const parent = lookup.parentOf(entry);
      const folderTitles = folderTitlesAt(catalogue.hierarchy, entry.path);
      return {
        kind: "leaf",
        key: `removed:${entry.path}`,
        entryId: entry.path,
        entryKind: entry.kind,
        label: `${entry.title} · Removed`,
        title: entry.title,
        tags: entry.tags ?? [],
        ...(folderTitles.length > 0 ? { folderTitles } : {}),
        removedPage: entry.kind === "page" || entry.kind === "document",
        ...(snapshotId ? { snapshotId } : {}),
        ...(parent?.source === "current"
          ? { parentId: parent.entry.path }
          : {}),
      };
    },
  );
  return withMovedRows(buildNavSections(catalogue.hierarchy, removed), lookup);
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

/** The selection a render without a shell store shows: All, unsearched. */
export const UNFILTERED_SELECTION: Pick<
  ViewerSelection,
  "view" | "search" | "tags"
> = { view: "all", search: "", tags: [] };

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
    searchRow(
      {
        path: leaf.entryId,
        title: leaf.title,
        ...(leaf.tags ? { tags: leaf.tags } : {}),
      },
      leaf.folderTitles ?? [],
    ),
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
      ) ||
      (node.members ?? []).some((member) =>
        navNodeVisible(member, selection, context),
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
      if (node.variants?.length || node.members?.length)
        result[variantDisclosureKey(node.entryId)] = navNodeContains(node, id);
      if (node.members)
        collectDefaults(node.members, section, id, depth + 1, result);
      continue;
    }
    result[folderDisclosureKey(section, node.key)] =
      depth === 0 || navNodeContains(node, id);
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
      const list = variantDisclosureKey(node.entryId);
      if (node.entryId === id)
        return node.variants?.length || node.members?.length ? [list] : [];
      if (node.variants?.some((variant) => variant.entryId === id))
        return [list];
      const member = node.members && nodePath(node.members, section, id);
      if (member) return [list, ...member];
      continue;
    }
    const child = nodePath(node.children, section, id);
    if (child) return [folderDisclosureKey(section, node.key), ...child];
  }
  return undefined;
}

/** Whether a row, its variants, its members, or its children hold `id`. */
export function navNodeContains(
  node: NavNode,
  id: string | undefined,
): boolean {
  return (
    id !== undefined &&
    (node.kind === "leaf"
      ? node.entryId === id ||
        (node.variants ?? []).some((variant) => variant.entryId === id) ||
        (node.members ?? []).some((member) => navNodeContains(member, id))
      : node.children.some((child) => navNodeContains(child, id)))
  );
}

/**
 * Persisted disclosure identity for one entry's list: its variants and, for a
 * folder's own screen or component, the folder's other members.
 */
export function variantDisclosureKey(parentId: string): string {
  return `variants:${parentId}`;
}
