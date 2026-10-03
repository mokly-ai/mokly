import type { CatalogueNode } from "../catalogue/types.js";
import {
  filterHierarchy,
  type CatalogueHierarchy,
  type HierarchyNode,
} from "../registry/hierarchy.js";
import type { ManifestEntry } from "../registry/types.js";

/** Retain the validated public tree's titles, order and hidden-folder flags. */
export function adoptCatalogueTree(
  hierarchy: CatalogueHierarchy<ManifestEntry>,
  nodes: readonly CatalogueNode[],
): CatalogueHierarchy<ManifestEntry> {
  const ancestors = new Map(hierarchy.ancestorsByPath);
  const convert = (
    node: CatalogueNode,
    titles: readonly string[],
  ): HierarchyNode<ManifestEntry> => {
    if (node.kind === "folder") {
      const index = node.index ? hierarchy.byPath.get(node.index) : undefined;
      return {
        kind: "folder",
        ...(node.hidden ? { hidden: true } : {}),
        path: node.path,
        key: node.path,
        label: node.title,
        ...(index ? { index } : {}),
        children: node.children.map((child) =>
          convert(
            child,
            child.path === node.path ? titles : [...titles, node.title],
          ),
        ),
      };
    }
    const entry = hierarchy.byPath.get(node.path)!;
    ancestors.set(entry.path, titles);
    return {
      kind: "entry",
      ...(node.hidden ? { hidden: true } : {}),
      entry,
      key: entry.path,
      label: entry.title,
      ...(node.children
        ? {
            children: node.children.map((child) =>
              convert(
                child,
                hierarchy.variantParentByPath.get(child.path)?.path ===
                  entry.path
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
    ...hierarchy,
    ancestorsByPath: ancestors,
    tree,
    roots: {
      pages: filterHierarchy(tree, false),
      components: filterHierarchy(tree, true),
    },
  };
}
