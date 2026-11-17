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
  navNodeVisible,
  navigationFiltering,
  variantDisclosureKey,
} from "./nav_model.js";
import { navRowPresentation } from "./nav_moves.js";
import type { NavLeafNode, NavSectionNode } from "./nav_tree.js";
import type { ShellStore } from "./store_context.js";

/**
 * What the rows of one render read. The store's disclosures hold every
 * current key, because the store builds them from the same sections.
 */
export interface NavRowsSource {
  /** The column's context; its `activeId` marks the current row. */
  context: ShellContext;
  /** Resolves a package-owned identifier in the shell root. */
  identifier: (value: string) => string;
  store: Pick<ShellStore, "context" | "state">;
}

/** The open state of `key` from before search or Changes began to filter. */
export function filterOpen(
  store: NavRowsSource["store"],
  key: string,
): boolean | undefined {
  const baseline = store.state.filterBaseline;
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
    store.state.selection.view === "changes",
    store.context,
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
    removed: node.removed === true,
    removedPage:
      node.removed === true &&
      (node.entryKind === "page" || node.entryKind === "document"),
    removedVariant: node.removedVariant === true,
    route: entryRoute(node.entryId),
    tags: node.tags ?? [],
  };
}

/**
 * A leaf row. An entry that owns variants, or a folder's own screen or
 * component with other members, discloses a list: the variants, then the
 * `members` rows. The store's disclosure decides whether the list is open,
 * except while search or Changes filters the tree: then the list is open
 * when it holds a match.
 */
export function navLeaf(
  node: NavLeafNode,
  depth: number,
  sectionId: NavSectionNode["id"],
  source: NavRowsSource,
  members: readonly NavigationRow[],
): NavigationLeaf {
  const { store } = source;
  const { selection } = store.state;
  const variants = node.variants ?? [];
  const memberNodes = node.members ?? [];
  const parentId = node.entryId;
  if (
    (variants.length === 0 && memberNodes.length === 0) ||
    !parentId ||
    !listShows(node, selection.view, store.context)
  ) {
    const hidden = !navLeafVisible(node, selection, store.context);
    return { kind: "leaf", link: navLink(node, depth, hidden, source) };
  }
  const key = variantDisclosureKey(parentId);
  return {
    kind: "leaf",
    link: navLink(node, depth, false, source),
    list: {
      disclosure: key,
      filterOpen: filterOpen(store, key),
      hidden: !navNodeVisible(node, selection, store.context),
      id: source.identifier(`mb-nav-variants-${sectionId}-${parentId}`),
      open: navigationFiltering(selection)
        ? variants.some((variant) =>
            navLeafVisible(variant, selection, store.context),
          ) ||
          memberNodes.some((member) =>
            navNodeVisible(member, selection, store.context),
          )
        : Boolean(store.state.disclosures[key]),
      rows: members,
      title: node.title,
      variants: variants.map((variant) =>
        navLink(
          variant,
          depth + 1,
          !navLeafVisible(variant, selection, store.context),
          source,
        ),
      ),
    },
  };
}

/**
 * Whether an entry's list holds a row that the selected filter can show,
 * before search narrows it. All lists no removed row, so a current entry
 * whose variants or members are all removed has no list there. Changes
 * keeps every list, so a parent with only removed variants still opens one.
 */
function listShows(
  node: NavLeafNode,
  view: "all" | "changes",
  context: ShellContext,
): boolean {
  if (view === "changes") return true;
  const all = { view, search: "", tags: [] };
  return (
    (node.variants ?? []).some((variant) =>
      navLeafVisible(variant, all, context),
    ) ||
    (node.members ?? []).some((member) => navNodeVisible(member, all, context))
  );
}
