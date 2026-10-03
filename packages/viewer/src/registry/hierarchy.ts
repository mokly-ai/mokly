import { compareNavigationNodes } from "./nav_paths.js";
import type { ManifestFolder } from "./types.js";

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
}
export type HierarchyNode<T extends HierarchyEntry> =
  HierarchyFolder<T> | HierarchyLeaf<T>;
/** One tree with projections for today's Pages and Components sections. */
export interface CatalogueHierarchy<T extends HierarchyEntry> {
  ancestorsByPath: ReadonlyMap<string, readonly string[]>;
  byPath: ReadonlyMap<string, T>;
  tree: readonly HierarchyNode<T>[];
  roots: {
    pages: readonly HierarchyNode<T>[];
    components: readonly HierarchyNode<T>[];
  };
  variantsByPath: ReadonlyMap<string, readonly T[]>;
  variantParentByPath: ReadonlyMap<string, T>;
}
/** Tree construction consumes validated identities; validation owns diagnostics. */
export interface HierarchyAnalysis<T extends HierarchyEntry> {
  hierarchy: CatalogueHierarchy<T>;
}

/** Resolve a folder's title without using display labels as identity. */
function folderTitle(
  path: string,
  record?: Pick<ManifestFolder, "title">,
  index?: Pick<HierarchyEntry, "title" | "kind">,
): string {
  if (index?.kind === "screen" || index?.kind === "component")
    return index.title;
  if (record?.title !== undefined) return record.title;
  if (index) return index.title;
  const slug = path.split("/").at(-1) ?? "";
  const title = slug.replace(/[-_]/g, " ");
  if (!title.trim()) return slug;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** Build one ordered path tree, then prune it by entry kind for each section. */
export function analyzeHierarchy<T extends HierarchyEntry>(
  entries: readonly T[],
  records: readonly ManifestFolder[] = [],
): HierarchyAnalysis<T> {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const folders = new Map<string, HierarchyFolder<T>>();
  const metadata = new Map(records.map((record) => [record.path, record]));
  const variantsByPath = new Map<string, T[]>();
  const variantParentByPath = new Map<string, T>();
  const roots: HierarchyNode<T>[] = [];
  for (const entry of entries) {
    if (typeof entry.variantOf === "string") {
      const parent = byPath.get(entry.variantOf);
      if (parent) {
        variantsByPath.set(parent.path, [
          ...(variantsByPath.get(parent.path) ?? []),
          entry,
        ]);
        variantParentByPath.set(entry.path, parent);
      }
      continue;
    }
    const segments = entry.path.split("/").slice(0, -1);
    let children = roots;
    for (let count = 1; count <= segments.length; count++) {
      const prefix = segments.slice(0, count).join("/");
      let folder = folders.get(prefix);
      if (!folder) {
        const index = byPath.get(prefix);
        folder = {
          kind: "folder",
          key: prefix,
          path: prefix,
          label: folderTitle(prefix, metadata.get(prefix), index),
          children: [],
          ...(index ? { index } : {}),
        };
        folders.set(prefix, folder);
        children.push(folder);
      }
      children = folder.children;
    }
  }
  const leaf = (entry: T): HierarchyLeaf<T> => ({
    kind: "entry",
    key: entry.path,
    label: entry.title,
    entry,
  });
  for (const entry of entries) {
    if (typeof entry.variantOf === "string") continue;
    const folder = folders.get(entry.path);
    if (folder) continue;
    const parent = entry.path.split("/").slice(0, -1).join("/");
    (folders.get(parent)?.children ?? roots).push(leaf(entry));
  }
  const build = (
    nodes: readonly HierarchyNode<T>[],
    parent: string,
  ): HierarchyNode<T>[] => {
    const built = nodes.map((original): HierarchyNode<T> => {
      const node = {
        ...original,
        ...(metadata.get(original.key)?.hidden
          ? { hidden: true as const }
          : {}),
      };
      if (node.kind === "entry") {
        const variants = (variantsByPath.get(node.entry.path) ?? []).map(leaf);
        return { ...node, ...(variants.length ? { children: variants } : {}) };
      }
      const members = build(node.children, node.path);
      const index = node.index;
      if (index?.kind === "screen" || index?.kind === "component") {
        return {
          ...leaf(index),
          ...(node.hidden ? { hidden: true } : {}),
          children: [
            ...(variantsByPath.get(index.path) ?? []).map(leaf),
            ...members,
          ],
        };
      }
      return {
        ...node,
        children: [...(index ? [leaf(index)] : []), ...members],
      };
    });
    return orderChildren(built, metadata.get(parent)?.order);
  };
  const tree = build(roots, "");
  const ancestorsByPath = new Map<string, readonly string[]>();
  for (const entry of entries) {
    const owningPath = variantParentByPath.get(entry.path)?.path ?? entry.path;
    const segments = owningPath.split("/").slice(0, -1);
    ancestorsByPath.set(
      entry.path,
      segments.map((_, index) => {
        const prefix = segments.slice(0, index + 1).join("/");
        return folderTitle(prefix, metadata.get(prefix), byPath.get(prefix));
      }),
    );
  }
  return {
    hierarchy: {
      byPath,
      ancestorsByPath,
      variantsByPath,
      variantParentByPath,
      tree,
      roots: {
        pages: filterHierarchy(tree, false),
        components: filterHierarchy(tree, true),
      },
    },
  };
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

/** Prune one shared tree by kind while retaining mixed-folder ancestry. */
export function filterHierarchy<T extends HierarchyEntry>(
  nodes: readonly HierarchyNode<T>[],
  components: boolean,
): HierarchyNode<T>[] {
  return nodes.flatMap((node): HierarchyNode<T>[] => {
    const children = filterHierarchy(node.children ?? [], components);
    if (node.kind === "folder") {
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
    if ((node.entry.kind === "component") === components) {
      const { children: _children, ...entry } = node;
      return [{ ...entry, ...(children.length ? { children } : {}) }];
    }
    return children.length
      ? [
          {
            kind: "folder",
            path: node.key,
            key: node.key,
            label: node.label,
            ...(node.hidden ? { hidden: true } : {}),
            children,
          },
        ]
      : [];
  });
}
