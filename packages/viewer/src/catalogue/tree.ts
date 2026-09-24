import type {
  CatalogueHierarchy,
  HierarchyNode,
} from "../registry/hierarchy.js";
import { compareNavigationNodes } from "../registry/nav_paths.js";

import type { CatalogueNode, CatalogueReadModel } from "./types.js";
/** Project current section folders and entries using their shared sibling order. */
interface TreeEntry {
  id: string;
  title: string;
  kind: string;
}

/** Serialize independent folder trees with variants below their parent entry. */
export function projectTree(
  hierarchy: CatalogueHierarchy<TreeEntry>,
): CatalogueReadModel["tree"] {
  const section = (
    nodes: readonly HierarchyNode<TreeEntry>[],
  ): CatalogueNode[] => {
    const project = (node: HierarchyNode<TreeEntry>): CatalogueNode => {
      if (node.kind === "folder")
        return {
          kind: "folder",
          label: node.label,
          children: [...node.children]
            .sort(compareNavigationNodes)
            .map(project),
        };
      const variants = hierarchy.variantsById.get(node.entry.id) ?? [];
      return {
        kind: "entry",
        id: node.entry.id,
        ...(variants.length > 0
          ? {
              children: variants.map((variant) => ({
                kind: "entry" as const,
                id: variant.id,
              })),
            }
          : {}),
      };
    };
    return [...nodes].sort(compareNavigationNodes).map(project);
  };
  return {
    pages: section(hierarchy.roots.pages),
    components: section(hierarchy.roots.components),
  };
}
