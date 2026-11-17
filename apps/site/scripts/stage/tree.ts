/** Section filtering and row ordering from mokly-catalogue-tree and mokly-folders. */

import type { CatalogueNode } from "@mokly/viewer";

import type { StageRow } from "../../src/stage.js";
import type { CatalogueEntry, CatalogueTree } from "./catalogue.js";

export interface StageNode {
  readonly path: string;
  readonly label: string;
  readonly kind: StageRow["kind"];
  readonly children: readonly StageNode[];
}

const KINDS = {
  component: "component",
  document: "page",
  page: "page",
  screen: "screen",
  "use-case": "flow",
} as const;

function defaultOrder(left: StageNode, right: StageNode): number {
  const folders =
    Number(right.kind === "folder") - Number(left.kind === "folder");
  return (
    folders ||
    left.label.localeCompare(right.label, "en") ||
    (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  );
}

/** Apply authored child slugs after computing the row each section renders. */
function ordered(
  nodes: readonly StageNode[],
  order: readonly string[] = [],
): StageNode[] {
  const remaining = [...nodes].sort(defaultOrder);
  const named = new Map(
    remaining.map((node) => [node.path.split("/").at(-1), node]),
  );
  const unnamed = remaining.filter(
    (node) => !order.includes(node.path.split("/").at(-1) ?? ""),
  );
  const result = order.flatMap((slug) => {
    if (slug === "...") return unnamed;
    const node = named.get(slug);
    return node ? [node] : [];
  });
  return order.includes("...") ? result : [...result, ...unnamed];
}

/** Keep shared ancestry, hide hidden subtrees, and retain authored variants. */
export function projectTree(
  entries: readonly CatalogueEntry[],
  catalogue: CatalogueTree,
  components: boolean,
): readonly StageNode[] {
  const records = new Map(entries.map((entry) => [entry.path, entry]));
  const project = (nodes: readonly CatalogueNode[]): StageNode[] =>
    nodes.flatMap((node) => {
      if (node.hidden) return [];
      const entry = node.kind === "entry" ? records.get(node.path) : undefined;
      const belongs = entry && (entry.kind === "component") === components;
      const children = project(node.children ?? []);
      if (!belongs && children.length === 0) return [];
      const first = children.filter((child) =>
        node.kind === "folder"
          ? child.path === node.index
          : records.get(child.path)?.variantOf === node.path,
      );
      const rest = children.filter((child) => !first.includes(child));
      const label =
        node.kind === "folder" ? node.title : (entry?.title ?? node.path);
      return [
        {
          path: node.path,
          label,
          kind: belongs ? KINDS[entry.kind] : "folder",
          children: [
            ...first.map((child) =>
              node.kind === "folder" && child.label === label
                ? { ...child, label: "Overview" }
                : child,
            ),
            ...ordered(rest, node.order),
          ],
        },
      ];
    });
  return ordered(project(catalogue.tree), catalogue.treeOrder);
}
