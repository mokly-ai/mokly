// Builds the Specs and Components sections from the one path tree.

import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import {
  folderTitleLookup,
  type FolderTitleLookup,
} from "../registry/folder_titles.js";
import type {
  CatalogueHierarchy,
  HierarchyNode,
} from "../registry/hierarchy.js";
import type { ManifestEntry } from "../registry/types.js";

import {
  adoptedVariants,
  attachRemovedVariants,
} from "./nav_removed_variants.js";

/** A leaf navigation row linking to one viewable route. */
export interface NavLeafNode {
  hidden?: true;
  entryId: CurrentPath;
  /**
   * The folder's own page, listed as the folder's first child row. Its label
   * is `Overview` when its title is also the folder's title.
   */
  index?: true;
  /**
   * A retained baseline page or document: a flat Changes row that All and
   * search hide, as removed screens are not.
   */
  removedPage?: boolean;
  /**
   * A retained baseline variant placed under its surviving parent. Like a
   * removed page it is a Changes row: All hides it, Changes shows it.
   */
  removedVariant?: boolean;
  /**
   * Entry id of the current parent a retained baseline variant attaches to,
   * as the branch-point lookup resolved it from the variant's baseline parent.
   */
  parentId?: CurrentPath;
  /** The branch-point path of an entry a move paired; Changes labels it Moved. */
  movedFrom?: BranchPointPath;
  entryKind: "component" | "document" | "screen" | "use-case" | "page";
  key: string;
  kind: "leaf";
  /** The text the row shows, which may differ from the entry's title. */
  label: string;
  /** The entry's own title, used by search and accessible names. */
  title: string;
  snapshotId?: string;
  /** Declared classification tags, present only when the entry has them. */
  tags?: readonly string[];
  /**
   * Titles of the folders at or above the entry's path, outermost first,
   * present only when there are any. Search matches them, so a folder whose
   * title matches shows every row below it.
   */
  folderTitles?: readonly string[];
  /**
   * Entries this row discloses as variants, in manifest order. Present only
   * on a screen or component parent; a variant never owns variants itself.
   */
  variants?: readonly NavLeafNode[];
  /**
   * The other members of the folder whose own page this screen or component
   * is. They follow the variants under the same disclosure.
   */
  members?: readonly NavNode[];
}

/** A collapsible navigation group with no destination of its own. */
export interface NavGroupNode {
  hidden?: true;
  children: NavNode[];
  key: string;
  kind: "group";
  label: string;
}

/** One rendered navigation node. */
export type NavNode = NavGroupNode | NavLeafNode;

/** One top-level catalogue section: components, or every other kind. */
export interface NavSectionNode {
  children: NavNode[];
  id: "components" | "specs";
  key: "section:components" | "section:specs";
  label: "Components" | "Specs";
}

/** The folder a node is listed in, used to recognise the folder's own page. */
interface NavFolderContext {
  path: string;
  title: string;
}

/** Shared lookups for projecting one hierarchy into rows. */
interface NavProjection {
  /** Each current variant's current parent, keyed by the variant's path. */
  parents: ReadonlyMap<
    string,
    ManifestEntry<CurrentPath, CurrentPath | BranchPointPath>
  >;
  titles: FolderTitleLookup;
}

/** Project the one path tree into the Specs and Components sections. */
export function buildNavSections(
  hierarchy: CatalogueHierarchy<
    ManifestEntry<CurrentPath, CurrentPath | BranchPointPath>
  >,
  additionalLeaves: readonly NavLeafNode[] = [],
): NavSectionNode[] {
  const adopted = adoptedVariants(hierarchy, additionalLeaves);
  const attached = new Set<NavLeafNode>();
  const projection: NavProjection = {
    parents: hierarchy.variantParentByPath,
    titles: folderTitleLookup(hierarchy),
  };
  const tree = {
    specs: attachRemovedVariants(
      hierarchy.roots.specs.map((node) => structuredNode(node, projection)),
      adopted,
      attached,
    ),
    components: attachRemovedVariants(
      hierarchy.roots.components.map((node) =>
        structuredNode(node, projection),
      ),
      adopted,
      attached,
    ),
  };
  const flat = additionalLeaves.filter((leaf) => !attached.has(leaf));
  return (["specs", "components"] as const).flatMap((id) => {
    const current = tree[id];
    const additional = flat.filter((leaf) =>
      id === "components"
        ? leaf.entryKind === "component"
        : leaf.entryKind !== "component",
    );
    const children = [
      ...current,
      ...additional.sort((left, right) =>
        left.entryKind < right.entryKind
          ? -1
          : left.entryKind > right.entryKind
            ? 1
            : left.entryId < right.entryId
              ? -1
              : left.entryId > right.entryId
                ? 1
                : 0,
      ),
    ];
    if (children.length === 0) return [];
    return [
      id === "specs"
        ? { children, id, key: "section:specs", label: "Specs" }
        : {
            children,
            id,
            key: "section:components",
            label: "Components",
          },
    ];
  });
}

/** One entry row, with the variants and folder members it discloses. */
function leafNode(
  entry: ManifestEntry<CurrentPath, CurrentPath | BranchPointPath>,
  titles: FolderTitleLookup,
  variants: readonly NavLeafNode[] = [],
  members: readonly NavNode[] = [],
): NavLeafNode {
  const folderTitles = titles(entry.path);
  return {
    entryId: entry.path,
    entryKind: entry.kind,
    key: `entry:${entry.path}`,
    kind: "leaf",
    label: entry.title,
    title: entry.title,
    ...(entry.tags && entry.tags.length > 0 ? { tags: [...entry.tags] } : {}),
    ...(folderTitles.length > 0 ? { folderTitles } : {}),
    ...(variants.length > 0 ? { variants } : {}),
    ...(members.length > 0 ? { members } : {}),
  };
}

function isVariantOf(
  node: HierarchyNode<
    ManifestEntry<CurrentPath, CurrentPath | BranchPointPath>
  >,
  path: string,
  projection: NavProjection,
): boolean {
  return (
    node.kind === "entry" &&
    projection.parents.get(node.entry.path)?.path === path
  );
}

/**
 * Project one tree node. A folder stays a folder row whose own page, when it
 * is a document, page, or use case, is its first child row. A screen or
 * component that is its folder's own page arrives as an entry node already,
 * so its row discloses its variants followed by the folder's other members.
 * A hidden folder hides every row below it, variants included.
 */
function structuredNode(
  node: HierarchyNode<
    ManifestEntry<CurrentPath, CurrentPath | BranchPointPath>
  >,
  projection: NavProjection,
  inheritedHidden = false,
  folder?: NavFolderContext,
): NavNode {
  const hidden = inheritedHidden || node.hidden === true;
  const visibility = hidden ? { hidden: true as const } : {};
  if (node.kind === "entry") {
    const entry = node.entry;
    const children = node.children ?? [];
    const variants = children.flatMap((child) =>
      child.kind === "entry" && isVariantOf(child, entry.path, projection)
        ? [{ ...leafNode(child.entry, projection.titles), ...visibility }]
        : [],
    );
    const members = children
      .filter((child) => !isVariantOf(child, entry.path, projection))
      .map((child) => structuredNode(child, projection, hidden));
    const leaf = leafNode(entry, projection.titles, variants, members);
    if (folder?.path !== entry.path) return { ...leaf, ...visibility };
    return {
      ...leaf,
      ...visibility,
      index: true,
      label: entry.title === folder.title ? "Overview" : entry.title,
    };
  }
  return {
    ...visibility,
    children: node.children.map((child) =>
      structuredNode(child, projection, hidden, {
        path: node.path,
        title: node.label,
      }),
    ),
    key: `folder:${node.key}`,
    kind: "group",
    label: node.label,
  };
}
