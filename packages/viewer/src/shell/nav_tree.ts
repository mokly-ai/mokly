// Builds one navigation model from explicit collection membership. Stable ids own disclosure identity;
// display labels never act as structural keys.

import type { CatalogueHierarchy } from "../registry/hierarchy.js";
import type { ManifestEntry } from "../registry/types.js";

/** A leaf navigation row linking to one viewable route. */
export interface NavLeafNode {
  entryId?: string;
  removedPage?: boolean;
  entryKind: "component" | "screen" | "use-case" | "page";
  key: string;
  kind: "leaf";
  label: string;
  route: string;
  /** Declared classification tags, present only when the entry has them. */
  tags?: readonly string[];
}

/** A collapsible navigation group with no destination of its own. */
export interface NavGroupNode {
  children: NavNode[];
  key: string;
  kind: "group";
  label: string;
}

/** One rendered navigation node. */
export type NavNode = NavGroupNode | NavLeafNode;

/** One top-level catalogue section separating component entries from pages. */
export interface NavSectionNode {
  children: NavNode[];
  id: "components" | "pages";
  key: "section:components" | "section:pages";
  label: "Components" | "Pages";
}

/** One breadcrumb segment, representing an authored collection ancestor. */
export interface CatalogueCrumb {
  label: string;
}

/** Build the nested navigation tree over the explicit catalogue hierarchy. */
export function buildNavTree(
  hierarchy: CatalogueHierarchy<ManifestEntry>,
): NavNode[] {
  const structured = hierarchy.roots.map((entry) =>
    structuredNode(entry, hierarchy, new Set()),
  );
  return sortNodes(structured);
}

/** Project the authored hierarchy into separate page and component sections. */
export function buildNavSections(
  hierarchy: CatalogueHierarchy<ManifestEntry>,
  additionalLeaves: readonly NavLeafNode[] = [],
): NavSectionNode[] {
  const tree = buildNavTree(hierarchy);
  return (["pages", "components"] as const).flatMap((id) => {
    const current = projectNodes(tree, id);
    const additional = additionalLeaves.filter((leaf) =>
      id === "components"
        ? leaf.entryKind === "component"
        : leaf.entryKind !== "component",
    );
    const children = [...current, ...additional];
    if (children.length === 0) return [];
    return [
      id === "pages"
        ? { children, id, key: "section:pages", label: "Pages" }
        : {
            children,
            id,
            key: "section:components",
            label: "Components",
          },
    ];
  });
}

/** Derive text-only crumbs for a structured entry from its real ancestors. */
export function structuredCrumbTrail(
  hierarchy: CatalogueHierarchy<ManifestEntry>,
  entryId: string,
): CatalogueCrumb[] {
  return (hierarchy.ancestorsById.get(entryId) ?? []).map((ancestor) => ({
    label: ancestor.title,
  }));
}

function structuredNode(
  entry: ManifestEntry,
  hierarchy: CatalogueHierarchy<ManifestEntry>,
  ancestors: ReadonlySet<string>,
): NavNode {
  if (entry.kind !== "collection") {
    return {
      entryId: entry.id,
      entryKind: entry.kind,
      key: `entry:${entry.id}`,
      kind: "leaf",
      label: entry.title,
      route: entry.route,
      ...(entry.tags && entry.tags.length > 0 ? { tags: [...entry.tags] } : {}),
    };
  }
  const visited = new Set(ancestors);
  visited.add(entry.id);
  const children = (hierarchy.childrenById.get(entry.id) ?? [])
    .filter((child) => !visited.has(child.id))
    .map((child) => structuredNode(child, hierarchy, visited));
  return {
    children: sortNodes(children),
    key: `collection:${entry.id}`,
    kind: "group",
    label: entry.title,
  };
}

function projectNodes(
  nodes: readonly NavNode[],
  section: NavSectionNode["id"],
): NavNode[] {
  return nodes.flatMap((node): NavNode[] => {
    if (node.kind === "leaf") {
      const component = node.entryKind === "component";
      return component === (section === "components") ? [node] : [];
    }
    const children = projectNodes(node.children, section);
    const emptyPageFolder = section === "pages" && node.children.length === 0;
    return children.length > 0 || emptyPageFolder
      ? [{ ...node, children }]
      : [];
  });
}

function sortNodes(nodes: readonly NavNode[]): NavNode[] {
  return [...nodes].sort(
    (left, right) =>
      nodeRank(left) - nodeRank(right) ||
      left.label.localeCompare(right.label) ||
      left.key.localeCompare(right.key),
  );
}

function nodeRank(node: NavNode): number {
  return node.kind === "group" ? 1 : 2;
}
