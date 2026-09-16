import type { CatalogueHierarchy } from "../registry/hierarchy.js";

import type { CatalogueNode, CatalogueReadModel } from "./types.js";
import { lexical } from "./values.js";

/** Project the validated forest without inheriting presentation or path sorting. */
interface TreeEntry {
  id: string;
  title: string;
  kind: string;
  childIds?: readonly string[];
}

export function projectTree(
  hierarchy: CatalogueHierarchy<TreeEntry>,
): CatalogueReadModel["tree"] {
  const section = (components: boolean): CatalogueNode[] => {
    const project = (entry: TreeEntry): CatalogueNode[] => {
      if (entry.kind !== "collection")
        return (entry.kind === "component") === components
          ? [{ kind: "entry", id: entry.id }]
          : [];
      const children = (hierarchy.childrenById.get(entry.id) ?? []).flatMap(
        project,
      );
      return children.length || (!components && !entry.childIds?.length)
        ? [{ kind: "collection", id: entry.id, children }]
        : [];
    };
    return [...hierarchy.roots]
      .sort((a, b) => lexical(a.id, b.id))
      .flatMap(project);
  };
  return { pages: section(false), components: section(true) };
}
