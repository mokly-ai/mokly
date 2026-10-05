import type { CatalogueNode } from "../src/catalogue/types.js";

/** Keep synthetic entry removals consistent with their public tree references. */
export function withoutTreeEntries(
  nodes: readonly CatalogueNode[],
  paths: readonly string[],
): readonly CatalogueNode[] {
  return nodes.flatMap((node): CatalogueNode[] => {
    if (paths.includes(node.path)) return [];
    if (!node.children) return [node];
    const children = withoutTreeEntries(node.children, paths);
    if (node.kind === "folder")
      return children.length ? [{ ...node, children }] : [];
    const { children: _children, ...leaf } = node;
    return [children.length ? { ...leaf, children } : leaf];
  });
}
