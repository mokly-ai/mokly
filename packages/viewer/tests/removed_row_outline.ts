import type { NavNode } from "../src/shell/nav_tree.js";

/**
 * Each row as its key, with the rows it holds, for order assertions. A folder
 * reads as its key and label; an entry row lists its variants, then members.
 */
export function outline(nodes: readonly NavNode[]): unknown[] {
  return nodes.map((node) =>
    node.kind === "group"
      ? { [`${node.key} ${node.label}`]: outline(node.children) }
      : node.variants || node.members
        ? {
            [node.key]: outline([
              ...(node.variants ?? []),
              ...(node.members ?? []),
            ]),
          }
        : node.key,
  );
}
