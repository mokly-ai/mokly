import { compareNavigationNodes } from "./nav_paths.js";

/** Entry metadata used by the shared path tree. */
export interface HierarchyEntry {
  path: string;
  kind: string;
  title: string;
  variantOf?: unknown;
}
/** A navigable entry, optionally containing variants and folder members. */
export interface HierarchyLeaf<T extends HierarchyEntry> {
  entry: T;
  key: string;
  kind: "entry";
  label: string;
  children?: HierarchyNode<T>[];
  hidden?: true;
  /** The `order` record of the folder whose own page this entry is. */
  order?: readonly string[];
}
/** A folder derived from descendants, with optional own page. */
export interface HierarchyFolder<T extends HierarchyEntry> {
  children: HierarchyNode<T>[];
  index?: T;
  key: string;
  kind: "folder";
  label: string;
  path: string;
  hidden?: true;
  /** The folder record's `order`, applied again in each section. */
  order?: readonly string[];
}
export type HierarchyNode<T extends HierarchyEntry> =
  HierarchyFolder<T> | HierarchyLeaf<T>;
/** One tree with its projections for the Specs and Components sections. */
export interface CatalogueHierarchy<T extends HierarchyEntry> {
  ancestorsByPath: ReadonlyMap<string, readonly string[]>;
  byPath: ReadonlyMap<string, T>;
  /** The top-level `order` record, applied again in each section. */
  order?: readonly string[];
  tree: readonly HierarchyNode<T>[];
  roots: {
    specs: readonly HierarchyNode<T>[];
    components: readonly HierarchyNode<T>[];
  };
  variantsByPath: ReadonlyMap<string, readonly T[]>;
  variantParentByPath: ReadonlyMap<string, T>;
}
/** Apply explicit slug order around the default unnamed remainder. */
function orderChildren<T extends HierarchyEntry>(
  nodes: readonly HierarchyNode<T>[],
  order?: readonly string[],
): HierarchyNode<T>[] {
  const sorted = [...nodes].sort(compareNavigationNodes);
  if (!order) return sorted;
  const named = new Set(order);
  const rest = sorted.filter((node) => !named.has(node.key.split("/").at(-1)!));
  const result = order.flatMap((slug) =>
    slug === "..."
      ? rest
      : sorted.filter((node) => node.key.split("/").at(-1) === slug),
  );
  return order.includes("...") ? result : [...result, ...rest];
}

/**
 * Prune one shared tree by kind while retaining mixed-folder ancestry. Each
 * section orders the children it shows again, by the rows they render as
 * there: a screen or component that is its folder's own page renders as a
 * folder row in the other section. A folder's own page stays its first row,
 * and variants keep their authored order.
 */
export function filterHierarchy<T extends HierarchyEntry>(
  nodes: readonly HierarchyNode<T>[],
  components: boolean,
  order?: readonly string[],
): HierarchyNode<T>[] {
  const shown = nodes.flatMap((node): HierarchyNode<T>[] => {
    if (node.kind === "folder") {
      const own = (child: HierarchyNode<T>) => child.key === node.key;
      const children = [
        ...filterHierarchy(node.children.filter(own), components),
        ...filterHierarchy(
          node.children.filter((child) => !own(child)),
          components,
          node.order,
        ),
      ];
      if (!children.length) return [];
      const { index, ...folder } = node;
      return [
        {
          ...folder,
          children,
          ...(index && (index.kind === "component") === components
            ? { index }
            : {}),
        },
      ];
    }
    const own = node.children ?? [];
    const members = filterHierarchy(
      own.filter((child) => !variantOf(child, node.entry.path)),
      components,
      node.order,
    );
    if ((node.entry.kind === "component") === components) {
      const { children: _children, ...entry } = node;
      const children = [
        ...own.filter((child) => variantOf(child, node.entry.path)),
        ...members,
      ];
      return [{ ...entry, ...(children.length ? { children } : {}) }];
    }
    return members.length
      ? [
          {
            kind: "folder",
            path: node.key,
            key: node.key,
            label: node.label,
            ...(node.hidden ? { hidden: true } : {}),
            ...(node.order ? { order: node.order } : {}),
            children: members,
          },
        ]
      : [];
  });
  return orderChildren(shown, order);
}

function variantOf<T extends HierarchyEntry>(
  node: HierarchyNode<T>,
  path: string,
): boolean {
  return node.kind === "entry" && node.entry.variantOf === path;
}
