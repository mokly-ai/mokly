/**
 * Moved rows: the branch-point path each paired entry's row records, and how a
 * row reads under each filter. Changes labels a moved row `· Moved` in place of
 * the changed mark, edited or not, so the move reads as one entry at its new
 * place rather than a removal and an addition.
 */

import type { NavLeafNode, NavNode, NavSectionNode } from "./nav_tree.js";

/** Copy the sections with each paired entry's branch-point path on its row. */
export function withMovedRows(
  sections: readonly NavSectionNode[],
  previousPaths: ReadonlyMap<string, string>,
): NavSectionNode[] {
  if (previousPaths.size === 0) return [...sections];
  const leaf = (node: NavLeafNode): NavLeafNode => {
    const movedFrom = node.key.startsWith("removed:")
      ? undefined
      : previousPaths.get(node.entryId);
    return {
      ...node,
      ...(movedFrom === undefined ? {} : { movedFrom }),
      ...(node.variants ? { variants: node.variants.map(leaf) } : {}),
      ...(node.members ? { members: node.members.map(row) } : {}),
    };
  };
  const row = (node: NavNode): NavNode =>
    node.kind === "group"
      ? { ...node, children: node.children.map(row) }
      : leaf(node);
  return sections.map((section) => ({
    ...section,
    children: section.children.map(row),
  }));
}

/** The label and changed marks one row shows under the selected filter. */
export function navRowPresentation(
  node: NavLeafNode,
  changesFilter: boolean,
  changedEntries: readonly string[] | undefined,
): { changed: boolean; changedVariants: boolean; label: string } {
  const moved = changesFilter && node.movedFrom !== undefined;
  return {
    changed: !moved && changedEntries?.includes(node.entryId) === true,
    changedVariants:
      !moved &&
      (node.variants ?? []).some(
        (variant) => changedEntries?.includes(variant.entryId) === true,
      ),
    label: moved ? `${node.label} · Moved` : node.label,
  };
}
