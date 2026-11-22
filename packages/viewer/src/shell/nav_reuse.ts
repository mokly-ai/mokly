import { keepEqualJson, sameJsonValue } from "../catalogue/json_values.js";
import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";

import type { Catalogue } from "./catalogue.js";
import { reuseByKey } from "./data_reuse.js";
import type { NavLeafNode, NavNode, NavSectionNode } from "./nav_tree.js";

/**
 * Compare the tree and entry fields used to place and name navigation rows.
 * Equal fields keep the installed sections without a rebuild, so this list
 * must hold every entry field that the section builders read: `nav_tree.ts`,
 * `nav_moves.ts`, `../registry/catalogue_hierarchy.ts`,
 * `../registry/folder_titles.ts`, and the parents of
 * `catalogue_branch_point.ts`. Add a field here when a builder reads it.
 */
export function sameNavigation(held: Catalogue, next: Catalogue): boolean {
  return (
    held.publicModel.tree === next.publicModel.tree &&
    held.publicModel.treeOrder === next.publicModel.treeOrder &&
    held.entries.length === next.entries.length &&
    next.entries.every((entry, index) =>
      sameEntry(held.entries[index]!, entry),
    ) &&
    held.removedEntries.length === next.removedEntries.length &&
    next.removedEntries.every((record, index) => {
      const before = held.removedEntries[index]!;
      return (
        record === before ||
        (record.snapshotId === before.snapshotId &&
          sameEntry(record.entry, before.entry))
      );
    })
  );
}

function sameEntry(
  held: ShellCatalogueRoutedEntry,
  next: ShellCatalogueRoutedEntry,
): boolean {
  return (
    held === next ||
    (held.path === next.path &&
      held.kind === next.kind &&
      held.title === next.title &&
      held.previousPath === next.previousPath &&
      ("variantOf" in held ? held.variantOf : undefined) ===
        ("variantOf" in next ? next.variantOf : undefined) &&
      sameJsonValue(held.tags, next.tags))
  );
}

/** Keep unchanged sections, folders, entries and variant lists. */
export function reuseSections(
  held: readonly NavSectionNode[],
  next: readonly NavSectionNode[],
): readonly NavSectionNode[] {
  return reuseByKey(held, next, nodeKey, (before, after) =>
    keepEqualJson(before, {
      ...after,
      children: reuseNodes(before.children, after.children),
    }),
  );
}

function nodeKey(node: { key: string }): string {
  return node.key;
}

function reuseNodes(
  held: readonly NavNode[],
  next: readonly NavNode[],
): readonly NavNode[] {
  return reuseByKey(held, next, nodeKey, (before, after) => {
    if (before.kind === "group" && after.kind === "group")
      return keepEqualJson(before, {
        ...after,
        children: reuseNodes(before.children, after.children),
      });
    if (before.kind === "leaf" && after.kind === "leaf")
      return reuseLeaf(before, after);
    return after;
  });
}

function reuseLeaf(held: NavLeafNode, next: NavLeafNode): NavLeafNode {
  return keepEqualJson(held, {
    ...next,
    ...(next.variants
      ? {
          variants: reuseByKey(
            held.variants ?? [],
            next.variants,
            nodeKey,
            reuseLeaf,
          ),
        }
      : {}),
    ...(next.members
      ? { members: reuseNodes(held.members ?? [], next.members) }
      : {}),
  });
}
