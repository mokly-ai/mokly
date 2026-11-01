/** The records of the catalogue hierarchy's sections and folders. */

import type {
  NavigationFolder,
  NavigationRow,
  NavigationSection,
} from "@mokly/ui/catalogue-tree";

import { folderDisclosureKey } from "./disclosure_keys.js";
import { filterOpen, navLeaf, type NavRowsSource } from "./nav_leaf_rows.js";
import { navNodeVisible, UNFILTERED_SELECTION } from "./nav_model.js";
import type { NavGroupNode, NavNode, NavSectionNode } from "./nav_tree.js";

/**
 * One authored folder projected into a section as a native disclosure. Its
 * count is the child rows the active filter keeps, decided by the same rule
 * as the rows themselves.
 */
function navFolder(
  node: NavGroupNode,
  depth: number,
  sectionId: NavSectionNode["id"],
  source: NavRowsSource,
): NavigationFolder {
  const { store } = source;
  const key = folderDisclosureKey(sectionId, node.key);
  const selection = store?.state.selection ?? UNFILTERED_SELECTION;
  const context = store?.context ?? source.context;
  return {
    count: node.children.filter((child) =>
      navNodeVisible(child, selection, context),
    ).length,
    depth,
    disclosure: key,
    filterOpen: filterOpen(store, key),
    hidden: !navNodeVisible(node, selection, context),
    key: node.key,
    kind: "folder",
    label: node.label,
    open: store?.state.disclosures[key] ?? depth === 0,
    rows: navRows(node.children, depth + 1, sectionId, source),
  };
}

/** Every row at one depth of a section's projected hierarchy. */
function navRows(
  nodes: readonly NavNode[],
  depth: number,
  sectionId: NavSectionNode["id"],
  source: NavRowsSource,
): NavigationRow[] {
  return nodes.map((node) =>
    node.kind === "group"
      ? navFolder(node, depth, sectionId, source)
      : navLeaf(
          node,
          depth,
          sectionId,
          source,
          node.members
            ? navRows(node.members, depth + 1, sectionId, source)
            : [],
        ),
  );
}

/**
 * One top-level section: open unless the reader closed it, and hidden when
 * the filters hide every row in it.
 */
export function navSection(
  section: NavSectionNode,
  source: NavRowsSource,
): NavigationSection {
  const { store } = source;
  return {
    disclosure: section.key,
    filterOpen: filterOpen(store, section.key),
    hidden: !section.children.some((node) =>
      navNodeVisible(
        node,
        store?.state.selection ?? UNFILTERED_SELECTION,
        store?.context ?? source.context,
      ),
    ),
    id: section.id,
    label: section.label,
    open: store?.state.disclosures[section.key] ?? true,
    rows: navRows(section.children, 0, section.id, source),
  };
}
