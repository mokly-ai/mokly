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

/**
 * The selection that shows a folder row: a query that hides it is cleared,
 * and the Changes filter gives way to All when no changed row lies inside.
 * Constraints that leave the row visible are kept.
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
    !navNodeVisible(node, { ...selection, search: "", tags: [] }, context);
  return {
    ...selection,
    ...(queryHides ? { search: "", tags: [] } : {}),
    ...(changesHides ? { view: "all" as const } : {}),
  };
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
