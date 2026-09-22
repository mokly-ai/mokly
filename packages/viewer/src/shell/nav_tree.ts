// Builds one navigation model from explicit collection membership. Stable ids own disclosure identity;
// display labels never act as structural keys.

import type { CatalogueHierarchy } from "../registry/hierarchy.js";
import type { ManifestEntry } from "../registry/types.js";

/** A leaf navigation row linking to one viewable route. */
export interface NavLeafNode {
  entryId?: string;
  removedPage?: boolean;
  /**
   * A retained baseline variant placed under its surviving parent. Like a
   * removed page it is a Changes row: All hides it, Changes shows it.
   */
  removedVariant?: boolean;
  /** Parent screen id a retained baseline variant still names. */
  variantOf?: string;
  entryKind: "component" | "screen" | "use-case" | "page";
  key: string;
  kind: "leaf";
  label: string;
  route: string;
  /** Declared classification tags, present only when the entry has them. */
  tags?: readonly string[];
  /**
   * Screens this row discloses as its variants, in manifest order. Present
   * only on a parent screen; a variant never carries variants of its own.
   */
  variants?: readonly NavLeafNode[];
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
  /** A viewable route this crumb links to; plain text when absent. */
  href?: string;
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
  const adopted = adoptedVariants(hierarchy, additionalLeaves);
  const attached = new Set<NavLeafNode>();
  const tree = attachRemovedVariants(
    buildNavTree(hierarchy),
    adopted,
    attached,
  );
  const flat = additionalLeaves.filter((leaf) => !attached.has(leaf));
  return (["pages", "components"] as const).flatMap((id) => {
    const current = projectNodes(tree, id);
    const additional = flat.filter((leaf) =>
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

/**
 * Retained baseline variants grouped by the surviving parent screen that
 * still claims them. A variant whose parent is gone, or whose parent is not a
 * current screen, keeps the flat removed row the removal rules give it.
 */
function adoptedVariants(
  hierarchy: CatalogueHierarchy<ManifestEntry>,
  leaves: readonly NavLeafNode[],
): Map<string, NavLeafNode[]> {
  const byParent = new Map<string, NavLeafNode[]>();
  for (const leaf of leaves) {
    const parentId = leaf.variantOf;
    if (parentId === undefined) continue;
    const parent = hierarchy.byId.get(parentId);
    if (parent?.kind !== "screen" || parent.variantOf !== undefined) continue;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), leaf]);
  }
  return byParent;
}

/**
 * Append each adopted variant to its parent's list, after the current ones.
 * Adoption is what makes the row a Changes row, so the flag is written here
 * rather than guessed again by whoever supplied the leaf.
 */
function attachRemovedVariants(
  nodes: readonly NavNode[],
  byParent: ReadonlyMap<string, readonly NavLeafNode[]>,
  attached: Set<NavLeafNode>,
): NavNode[] {
  if (byParent.size === 0) return [...nodes];
  return nodes.map((node) => {
    if (node.kind === "group")
      return {
        ...node,
        children: attachRemovedVariants(node.children, byParent, attached),
      };
    const removed = node.entryId ? byParent.get(node.entryId) : undefined;
    for (const leaf of removed ?? []) attached.add(leaf);
    return removed
      ? {
          ...node,
          variants: [
            ...(node.variants ?? []),
            ...removed.map((leaf) => ({ ...leaf, removedVariant: true })),
          ],
        }
      : node;
  });
}

/** One routed entry, the only entry kind a navigation leaf can represent. */
type RoutedManifestEntry = Exclude<ManifestEntry, { kind: "collection" }>;

/**
 * One leaf row plus the variant rows it discloses. The hierarchy already keeps
 * variants out of `roots` and `childrenById`, so a variant reaches the tree
 * only through this list and never as a row of its own.
 */
function leafNode(
  entry: RoutedManifestEntry,
  variants: readonly NavLeafNode[],
): NavLeafNode {
  return {
    entryId: entry.id,
    entryKind: entry.kind,
    key: `entry:${entry.id}`,
    kind: "leaf",
    label: entry.title,
    route: entry.route,
    ...(entry.tags && entry.tags.length > 0 ? { tags: [...entry.tags] } : {}),
    ...(variants.length > 0 ? { variants } : {}),
  };
}

function structuredNode(
  entry: ManifestEntry,
  hierarchy: CatalogueHierarchy<ManifestEntry>,
  ancestors: ReadonlySet<string>,
): NavNode {
  if (entry.kind !== "collection") {
    return leafNode(
      entry,
      (hierarchy.variantsById.get(entry.id) ?? []).flatMap((variant) =>
        variant.kind === "collection" ? [] : [leafNode(variant, [])],
      ),
    );
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
