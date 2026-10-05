import type { CatalogueNode } from "../catalogue/types.js";
import {
  filterHierarchy,
  type CatalogueHierarchy,
  type HierarchyNode,
} from "../registry/hierarchy.js";
import type { ManifestEntry } from "../registry/types.js";

/**
 * Retain the validated public tree's titles, order and hidden-folder flags,
 * with the folder `order` lists each section applies again.
 */
export function adoptCatalogueTree(
  hierarchy: CatalogueHierarchy<ManifestEntry>,
  nodes: readonly CatalogueNode[],
  order?: readonly string[],
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
        ...(node.order ? { order: node.order } : {}),
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
      ...(node.order ? { order: node.order } : {}),
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
  const { order: _previous, ...adopted } = hierarchy;
  return {
    ...adopted,
    ancestorsByPath: ancestors,
    tree,
    ...(order ? { order } : {}),
    roots: {
      specs: filterHierarchy(tree, false, order),
      components: filterHierarchy(tree, true, order),
    },
  };
}
