/** The records of leaf rows and of the entry lists that they disclose. */

import type {
  NavigationLeaf,
  NavigationLink,
  NavigationRow,
} from "@mokly/ui/catalogue-tree";

import { entryRoute, viewHref } from "../navigation/routes.js";

import type { ShellContext } from "./context.js";
import {
  navLeafVisible,
  navNodeContains,
  navNodeVisible,
  navigationFiltering,
  variantDisclosureKey,
} from "./nav_model.js";
import { navRowPresentation } from "./nav_moves.js";
import type { NavLeafNode, NavSectionNode } from "./nav_tree.js";
import type { ShellStore } from "./store_context.js";

/**
 * What the rows of one render read. Without a store, the rows show the
 * column's context unfiltered, with the default disclosures.
 */
export interface NavRowsSource {
  /** The column's context; its `activeId` marks the current row. */
  context: ShellContext;
  /** Resolves a package-owned identifier in the shell root. */
  identifier: (value: string) => string;
  store: Pick<ShellStore, "context" | "state"> | undefined;
}

/** The open state of `key` from before search or Changes began to filter. */
export function filterOpen(
  store: NavRowsSource["store"],
  key: string,
): boolean | undefined {
  const baseline = store?.state.filterBaseline;
  return baseline ? Boolean(baseline[key]) : undefined;
}

/** One row link, for a leaf or for one of the variants that it holds. */
function navLink(
  node: NavLeafNode,
  depth: number,
  hidden: boolean,
  source: NavRowsSource,
): NavigationLink {
  const { store } = source;
  const { changed, changedVariants, label } = navRowPresentation(
    node,
    store?.state.selection.view === "changes",
    store?.context ?? source.context,
  );
  return {
    changed,
    changedVariants,
    current: node.entryId === source.context.activeId,
    depth,
    entry: node.entryId,
    hidden,
    href: `${viewHref(node.entryId)}${
      node.snapshotId ? `?snapshot=${node.snapshotId}` : ""
    }`,
    index: node.index === true,
    key: node.key,
    kind: node.entryKind,
    label,
    removed: node.key.startsWith("removed:"),
    removedPage: node.removedPage === true,
    removedVariant: node.removedVariant === true,
    route: entryRoute(node.entryId),
    tags: node.tags ?? [],
  };
}

/**
 * A leaf row. An entry that owns variants, or a folder's own screen or
 * component with other members, discloses a list: the variants, then the
 * `members` rows. Without a stored choice, the list is open only while it
 * holds the active route or the active route is the entry itself. While
 * search or Changes filters the tree, the list is open when it holds a match.
 */
export function navLeaf(
  node: NavLeafNode,
  depth: number,
  sectionId: NavSectionNode["id"],
  source: NavRowsSource,
  members: readonly NavigationRow[],
): NavigationLeaf {
  const { store } = source;
  const variants = node.variants ?? [];
  const memberNodes = node.members ?? [];
  const parentId = node.entryId;
  const leafVisible = store
    ? navLeafVisible(node, store.state.selection, store.context)
    : !node.removedPage && !node.removedVariant && !node.hidden;
  if ((variants.length === 0 && memberNodes.length === 0) || !parentId)
    return { kind: "leaf", link: navLink(node, depth, !leafVisible, source) };
  const key = variantDisclosureKey(parentId);
  const filtering = store ? navigationFiltering(store.state.selection) : false;
  const parentVisible = store
    ? navNodeVisible(node, store.state.selection, store.context)
    : !node.hidden;
  const listMatches = store
    ? variants.some((variant) =>
        navLeafVisible(variant, store.state.selection, store.context),
      ) ||
      memberNodes.some((member) =>
        navNodeVisible(member, store.state.selection, store.context),
      )
    : true;
  const active = navNodeContains(node, source.context.activeId);
  return {
    kind: "leaf",
    link: navLink(node, depth, false, source),
    list: {
      disclosure: key,
      filterOpen: filterOpen(store, key),
      hidden: !parentVisible,
      id: source.identifier(`mb-nav-variants-${sectionId}-${parentId}`),
      open: filtering ? listMatches : (store?.state.disclosures[key] ?? active),
      rows: members,
      title: node.title,
      variants: variants.map((variant) =>
        navLink(
          variant,
          depth + 1,
          store
            ? !navLeafVisible(variant, store.state.selection, store.context)
            : Boolean(variant.removedVariant || variant.hidden),
          source,
        ),
      ),
    },
  };
}
