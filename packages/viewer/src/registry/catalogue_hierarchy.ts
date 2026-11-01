import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import type { CatalogueNode } from "../catalogue/types.js";

import {
  filterHierarchy,
  type CatalogueHierarchy,
  type HierarchyNode,
} from "./hierarchy.js";

/**
 * Retain the validated public tree's titles, order and hidden-folder flags,
 * with the folder `order` lists each section applies again.
 */
export function catalogueHierarchy(
  entries: readonly ShellCatalogueRoutedEntry[],
  nodes: readonly CatalogueNode[],
  order?: readonly string[],
): CatalogueHierarchy<ShellCatalogueRoutedEntry> {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const variantsByPath = new Map<string, ShellCatalogueRoutedEntry[]>();
  const variantParentByPath = new Map<string, ShellCatalogueRoutedEntry>();
  for (const entry of entries) {
    if (!("variantOf" in entry) || entry.variantOf === undefined) continue;
    const parent = byPath.get(entry.variantOf);
    if (!parent) continue;
    const variants = variantsByPath.get(parent.path) ?? [];
    variants.push(entry);
    variantsByPath.set(parent.path, variants);
    variantParentByPath.set(entry.path, parent);
  }
  const ancestors = new Map<string, readonly string[]>();
  const convert = (
    node: CatalogueNode,
    titles: readonly string[],
  ): HierarchyNode<ShellCatalogueRoutedEntry> => {
    if (node.kind === "folder") {
      const index = node.index ? byPath.get(node.index) : undefined;
      return {
        kind: "folder",
        ...(node.hidden ? { hidden: true } : {}),
        path: node.path,
        key: node.path,
        label: node.title,
        ...(index ? { index } : {}),
        ...(node.order ? { order: node.order } : {}),
        children: node.children.map((child) =>
          convert(
            child,
            child.path === node.path ? titles : [...titles, node.title],
          ),
        ),
      };
    }
    const entry = byPath.get(node.path)!;
    ancestors.set(entry.path, titles);
    return {
      kind: "entry",
      ...(node.hidden ? { hidden: true } : {}),
      entry,
      key: entry.path,
      label: entry.title,
      ...(node.order ? { order: node.order } : {}),
      ...(node.children
        ? {
            children: node.children.map((child) =>
              convert(
                child,
                variantParentByPath.get(child.path)?.path === entry.path
                  ? titles
                  : [...titles, entry.title],
              ),
            ),
          }
        : {}),
    };
  };
  const tree = nodes.map((node) => convert(node, []));
  return {
    byPath,
    variantsByPath,
    variantParentByPath,
    ancestorsByPath: ancestors,
    tree,
    ...(order ? { order } : {}),
    roots: {
      specs: filterHierarchy(tree, false, order),
      components: filterHierarchy(tree, true, order),
    },
  };
}
