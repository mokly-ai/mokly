import type { BranchPointLookup } from "../catalogue/branch_point_types.js";
import type { ManifestEntry } from "../registry/types.js";
/**
 * Moved rows: the branch-point path each paired entry's row records, and how a
 * row reads under each filter. Changes labels a moved row `· Moved` in place of
 * the changed mark, edited or not, so the move reads as one entry at its new
 * place rather than a removal and an addition. All marks a moved row only when
 * its entry changed beyond the move.
 */

import { materialChangedEntries, type ShellContext } from "./context.js";
import type { NavLeafNode, NavNode, NavSectionNode } from "./nav_tree.js";

/** Copy the sections with each paired entry's branch-point path on its row. */
export function withMovedRows(
  sections: readonly NavSectionNode[],
  lookup: Pick<BranchPointLookup<ManifestEntry>, "previousPath">,
): NavSectionNode[] {
  const leaf = (node: NavLeafNode): NavLeafNode => {
    const movedFrom = node.key.startsWith("removed:")
      ? undefined
      : lookup.previousPath({ kind: node.entryKind, path: node.entryId });
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
  context: ShellContext,
): { changed: boolean; changedVariants: boolean; label: string } {
  const moved = changesFilter && node.movedFrom !== undefined;
  const material = changesFilter ? undefined : materialChangedEntries(context);
  const marked = (row: NavLeafNode) =>
    context.changedEntries?.includes(row.entryId) === true &&
    (material === undefined ||
      row.movedFrom === undefined ||
      material.includes(row.entryId));
  return {
    changed: !moved && marked(node),
    changedVariants: !moved && (node.variants ?? []).some(marked),
    label: moved ? `${node.label} · Moved` : node.label,
  };
}
