/** Pure rules for revealing a folder row from a breadcrumb. */

import type { ViewerSelection } from "../viewer/types.js";

import type { ShellContext } from "./context.js";
import { folderDisclosureKey } from "./disclosure_keys.js";
import { navNodeVisible, variantDisclosureKey } from "./nav_model.js";
import type { NavGroupNode, NavNode, NavSectionNode } from "./nav_tree.js";

/** A folder row and every disclosure, its own last, that exposes it. */
export interface FolderRevealPath {
  keys: readonly string[];
  node: NavGroupNode;
}

/** Locate one section's folder row by path. */
export function folderRevealPath(
  sections: readonly NavSectionNode[],
  sectionId: NavSectionNode["id"],
  path: string,
): FolderRevealPath | undefined {
  const section = sections.find(({ id }) => id === sectionId);
  if (!section) return undefined;
  const found = findFolder(section.children, section.id, `folder:${path}`);
  return found && { keys: [section.key, ...found.keys], node: found.node };
}

/** The selection fields that decide which rows the tree shows. */
type NavFilters = Pick<ViewerSelection, "view" | "search" | "tags">;

/**
 * The selection that shows a folder row: a query that hides it is cleared,
 * and the Changes filter gives way to All when no changed row lies inside.
 * Constraints that leave the row visible are kept. When the query and the
 * Changes filter hide the row only together, the query is cleared, and All
 * is the last resort.
 */
export function folderRevealSelection(
  node: NavGroupNode,
  selection: ViewerSelection,
  context: ShellContext,
): ViewerSelection {
  if (navNodeVisible(node, selection, context)) return selection;
  const queryHides = !navNodeVisible(
    node,
    { ...selection, view: "all" },
    context,
  );
  const changesHides =
    selection.view === "changes" &&
    !navNodeVisible(node, withoutQuery(selection), context);
  const separate = {
    ...(queryHides ? withoutQuery(selection) : selection),
    ...(changesHides ? { view: "all" as const } : {}),
  };
  if (navNodeVisible(node, separate, context)) return separate;
  const cleared = withoutQuery(separate);
  return navNodeVisible(node, cleared, context)
    ? cleared
    : { ...cleared, view: "all" };
}

/**
 * The change an application-owned host commits for a reveal. A cleared query
 * is proposed whole, search and tags together, with an empty search box.
 */
export function folderRevealProposal(
  before: ViewerSelection,
  after: ViewerSelection,
): { rawQuery?: string; selection: Partial<ViewerSelection> } | undefined {
  const cleared = !sameQuery(before, after);
  const viewChanged = before.view !== after.view;
  if (!cleared && !viewChanged) return undefined;
  return {
    ...(cleared ? { rawQuery: "" } : {}),
    selection: {
      ...(cleared ? { search: "", tags: [] } : {}),
      ...(viewChanged ? { view: after.view } : {}),
    },
  };
}

/** Whether two selections share one view, search, and tag set. */
export function sameNavFilters(a: NavFilters, b: NavFilters): boolean {
  return a.view === b.view && sameQuery(a, b);
}

function sameQuery(a: NavFilters, b: NavFilters): boolean {
  return (
    a.search === b.search &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  );
}

function withoutQuery<T extends NavFilters>(selection: T): T {
  return { ...selection, search: "", tags: [] };
}

function findFolder(
  nodes: readonly NavNode[],
  section: NavSectionNode["id"],
  key: string,
): FolderRevealPath | undefined {
  for (const node of nodes) {
    if (node.kind === "leaf") {
      const member = node.members && findFolder(node.members, section, key);
      if (member)
        return {
          keys: [variantDisclosureKey(node.entryId), ...member.keys],
          node: member.node,
        };
      continue;
    }
    const own = folderDisclosureKey(section, node.key);
    if (node.key === key) return { keys: [own], node };
    const child = findFolder(node.children, section, key);
    if (child) return { keys: [own, ...child.keys], node: child.node };
  }
  return undefined;
}
