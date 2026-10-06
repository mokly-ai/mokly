/**
 * Removed-variant attachment: each retained baseline variant joins the list of
 * the current parent the branch-point lookup resolved for it, after the
 * current variants. A row that cannot attach stays a flat removed row.
 */

import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import type { CatalogueHierarchy } from "../registry/hierarchy.js";
import type { ManifestEntry } from "../registry/types.js";

import type { NavLeafNode, NavNode } from "./nav_tree.js";

/**
 * Retained baseline variants grouped by the surviving same-kind parent the
 * lookup resolved for them. An ineligible variant keeps its flat removed row.
 */
export function adoptedVariants(
  hierarchy: CatalogueHierarchy<
    ManifestEntry<CurrentPath, CurrentPath | BranchPointPath>
  >,
  leaves: readonly NavLeafNode[],
): Map<string, NavLeafNode[]> {
  const byParent = new Map<string, NavLeafNode[]>();
  for (const leaf of leaves) {
    const parentId = leaf.parentId;
    if (parentId === undefined) continue;
    if (
      hierarchy.byPath.get(parentId)?.kind !== leaf.entryKind ||
      hierarchy.variantParentByPath.has(parentId)
    )
      continue;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), leaf]);
  }
  return byParent;
}

/**
 * Append each adopted variant to its parent's list, after the current ones.
 * Adoption is what makes the row a Changes row, so the flag is written here
 * rather than guessed again by whoever supplied the leaf.
 */
export function attachRemovedVariants(
  nodes: readonly NavNode[],
  byParent: ReadonlyMap<string, readonly NavLeafNode[]>,
  attached: Set<NavLeafNode>,
): NavNode[] {
  if (byParent.size === 0) return [...nodes];
  return nodes.map((node) => {
    if (node.kind === "group")
      return {
        ...node,
        children: attachRemovedVariants(node.children, byParent, attached),
      };
    const removed = byParent.get(node.entryId);
    for (const leaf of removed ?? []) attached.add(leaf);
    const members = node.members
      ? { members: attachRemovedVariants(node.members, byParent, attached) }
      : {};
    return removed
      ? {
          ...node,
          ...members,
          variants: [
            ...(node.variants ?? []),
            ...removed.map((leaf) => ({ ...leaf, removedVariant: true })),
          ],
        }
      : { ...node, ...members };
  });
}
