/**
 * Removed-row placement: each removed row Changes shows stands where its
 * entry stood at the branch point, as a deleted file does in a code diff. The
 * row joins the deepest folder or entry row of its former path that the
 * section still shows, after that container's current rows. A former folder
 * the section no longer shows comes back as a folder row with its
 * branch-point title, before the removed entry rows of its container, as a
 * code diff lists folders before files. A path that a current entry holds,
 * such as a former parent that is now a variant, is never recreated. A
 * removed variant whose parent was removed too joins that parent's variants.
 */

import type { NavGroupNode, NavLeafNode, NavNode } from "./nav_tree.js";

/** The section's current rows and the removed rows placed among them. */
interface Placement {
  /** Rows appended after the current rows, keyed by container path. */
  appended: Map<string, NavNode[]>;
  /** Paths of the folders and entry rows the section shows. */
  containers: ReadonlySet<string>;
  /** Whether a current entry of any section holds a path. */
  current: (path: string) => boolean;
  /** A removed folder page, listed first in the folder at its own path. */
  own: Map<string, NavLeafNode>;
  /** Recreated folder rows by path. */
  recreated: Map<string, NavGroupNode>;
  /** Branch-point folder titles by path, from every removed row. */
  titles: ReadonlyMap<string, string>;
}

const ROOT = "";

/** Place the removed rows of one section into its current rows. */
export function placeRemovedRows(
  nodes: readonly NavNode[],
  removed: readonly NavLeafNode[],
  current: (path: string) => boolean,
): NavNode[] {
  if (removed.length === 0) return [...nodes];
  const rows = withRemovedVariants(removed);
  const placement: Placement = {
    appended: new Map(),
    containers: containerPaths(nodes),
    current,
    own: new Map(),
    recreated: new Map(),
    titles: formerTitles(rows),
  };
  for (const row of rows)
    ensureFolder(target(row.entryId, placement), placement);
  for (const row of rows) {
    const path = row.entryId;
    if (placement.recreated.has(path) || placement.containers.has(path))
      placement.own.set(path, row);
    else append(placement, target(path, placement), row);
  }
  for (const [path, group] of placement.recreated)
    group.children.push(...contents(path, placement));
  return [
    ...nodes.map((node) => fill(node, placement)),
    ...(placement.appended.get(ROOT) ?? []),
  ];
}

/**
 * Attach each removed variant whose parent row is also removed to that row,
 * after any variants the parent row already lists.
 */
function withRemovedVariants(
  removed: readonly NavLeafNode[],
): readonly NavLeafNode[] {
  const parents = new Set(removed.map((row) => row.entryId));
  const byParent = new Map<string, NavLeafNode[]>();
  for (const row of removed) {
    const parent = row.removedParentId;
    if (parent === undefined || !parents.has(parent)) continue;
    byParent.set(parent, [
      ...(byParent.get(parent) ?? []),
      { ...row, removedVariant: true },
    ]);
  }
  return removed.flatMap((row) => {
    if (row.removedParentId !== undefined && parents.has(row.removedParentId))
      return [];
    const variants = byParent.get(row.entryId);
    return variants
      ? [{ ...row, variants: [...(row.variants ?? []), ...variants] }]
      : [row];
  });
}

/**
 * Every folder and entry row path the section shows. An entry row holds the
 * rows below its path as folder members, as a folder's own screen does.
 */
function containerPaths(nodes: readonly NavNode[]): Set<string> {
  const paths = new Set<string>();
  const visit = (node: NavNode): void => {
    if (node.kind === "group") {
      paths.add(groupPath(node));
      node.children.forEach(visit);
    } else {
      paths.add(node.entryId);
      node.members?.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return paths;
}

/**
 * The container a path's row joins: its deepest ancestor that the section
 * shows or that no current entry holds, or the section root.
 */
function target(path: string, placement: Placement): string {
  const above = ancestors(path).slice(0, -1).reverse();
  return (
    above.find(
      (folder) =>
        placement.containers.has(folder) || !placement.current(folder),
    ) ?? ROOT
  );
}

/** Recreate a former folder and each missing folder above it. */
function ensureFolder(path: string, placement: Placement): void {
  if (
    path === ROOT ||
    placement.containers.has(path) ||
    placement.recreated.has(path)
  )
    return;
  const parent = target(path, placement);
  ensureFolder(parent, placement);
  const group: NavGroupNode = {
    children: [],
    key: `folder:${path}`,
    kind: "group",
    label: placement.titles.get(path) ?? path.split("/").at(-1)!,
  };
  placement.recreated.set(path, group);
  append(placement, parent, group);
}

function append(placement: Placement, path: string, node: NavNode): void {
  placement.appended.set(path, [...(placement.appended.get(path) ?? []), node]);
}

/** A recreated folder's removed folder page first, then its other rows. */
function contents(path: string, placement: Placement): NavNode[] {
  const own = placement.own.get(path);
  return [...(own ? [own] : []), ...(placement.appended.get(path) ?? [])];
}

/** Copy one current node with the removed rows that belong inside it. */
function fill(node: NavNode, placement: Placement): NavNode {
  if (node.kind === "group") {
    const path = groupPath(node);
    const own = placement.own.get(path);
    return {
      ...node,
      children: [
        ...(own ? [own] : []),
        ...node.children.map((child) => fill(child, placement)),
        ...(placement.appended.get(path) ?? []),
      ],
    };
  }
  const added = placement.appended.get(node.entryId) ?? [];
  if (!node.members && added.length === 0) return node;
  return {
    ...node,
    members: [
      ...(node.members ?? []).map((member) => fill(member, placement)),
      ...added,
    ],
  };
}

/** Each former folder's branch-point title, from the rows below it. */
function formerTitles(rows: readonly NavLeafNode[]): Map<string, string> {
  const titles = new Map<string, string>();
  const visit = (row: NavLeafNode): void => {
    const folders = ancestors(row.entryId);
    row.formerFolderTitles?.forEach((title, index) => {
      const path = folders[index];
      if (path !== undefined && !titles.has(path)) titles.set(path, title);
    });
    row.variants?.forEach(visit);
  };
  rows.forEach(visit);
  return titles;
}

/** The path of a folder row, which its key carries after `folder:`. */
function groupPath(node: NavGroupNode): string {
  return node.key.slice("folder:".length);
}

/** Every path at or above one path, outermost first. */
function ancestors(path: string): string[] {
  const segments = path.split("/");
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}
