import type {
  CatalogueHierarchy,
  HierarchyEntry,
  HierarchyNode,
} from "../registry/hierarchy.js";

import type { CatalogueNode } from "./types.js";

/** Serialize the shared path tree, preserving folder order and index rows. */
export function projectTree<T extends HierarchyEntry>(
  hierarchy: CatalogueHierarchy<T>,
): readonly CatalogueNode[] {
  const project = (node: HierarchyNode<T>): CatalogueNode =>
    node.kind === "folder"
      ? {
          kind: "folder",
          ...(node.hidden ? { hidden: true } : {}),
          path: node.path,
          title: node.label,
          ...(node.index ? { index: node.index.path } : {}),
          ...(node.order ? { order: [...node.order] } : {}),
          children: node.children.map(project),
        }
      : {
          kind: "entry",
          ...(node.hidden ? { hidden: true } : {}),
          path: node.entry.path,
          ...(node.order ? { order: [...node.order] } : {}),
          ...(node.children?.length
            ? { children: node.children.map(project) }
            : {}),
        };
  return hierarchy.tree.map(project);
}
