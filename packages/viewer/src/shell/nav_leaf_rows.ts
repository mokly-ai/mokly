/** The records of leaf rows and of the entry lists that they disclose. */

import type {
  NavigationLeaf,
  NavigationLink,
  NavigationRow,
} from "@mokly/ui/catalogue-tree";

import { entryRoute, viewHref } from "../navigation/routes.js";

import type { NavigationContext } from "./context.js";
import {
  navLeafVisible,
  navNodeVisible,
  navigationFiltering,
  variantDisclosureKey,
  type NavigationSelection,
} from "./nav_model.js";
import { navRowPresentation } from "./nav_moves.js";
import type { NavLeafNode, NavSectionNode } from "./nav_tree.js";
import type { ShellState } from "./store_state.js";

/**
 * What the rows of one render read. The store's disclosures hold every
 * current key, because the store builds them from the same sections.
 */
export interface NavRowsSource {
  activeId: string | undefined;
  context: NavigationContext;
  /** Resolves a package-owned identifier in the shell root. */
  identifier: (value: string) => string;
  state: Pick<ShellState, "disclosures" | "filterBaseline"> & {
    selection: NavigationSelection;
  };
}

/** The open state of `key` from before search or Changes began to filter. */
export function filterOpen(
  state: NavRowsSource["state"],
  key: string,
): boolean | undefined {
  const baseline = state.filterBaseline;
  return baseline ? Boolean(baseline[key]) : undefined;
}

/** One row link, for a leaf or for one of the variants that it holds. */
function navLink(
  node: NavLeafNode,
  depth: number,
  hidden: boolean,
  source: NavRowsSource,
): NavigationLink {
  const { activeId, context, state } = source;
  const { changed, changedVariants, label } = navRowPresentation(
    node,
    state.selection.view === "changes",
    context,
  );
  return {
    changed,
    changedVariants,
    current: node.entryId === activeId,
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
  const { context, state } = source;
  const { selection } = state;
  const variants = node.variants ?? [];
  const memberNodes = node.members ?? [];
  const parentId = node.entryId;
  if (
    (variants.length === 0 && memberNodes.length === 0) ||
    !parentId ||
    !listShows(node, selection.view, context)
  ) {
    const hidden = !navLeafVisible(node, selection, context);
    return { kind: "leaf", link: navLink(node, depth, hidden, source) };
  }
  const key = variantDisclosureKey(parentId);
  return {
    kind: "leaf",
    link: navLink(node, depth, false, source),
    list: {
      disclosure: key,
      filterOpen: filterOpen(state, key),
      hidden: !navNodeVisible(node, selection, context),
      id: source.identifier(`mb-nav-variants-${sectionId}-${parentId}`),
      open: navigationFiltering(selection)
        ? variants.some((variant) =>
            navLeafVisible(variant, selection, context),
          ) ||
          memberNodes.some((member) =>
            navNodeVisible(member, selection, context),
          )
        : Boolean(state.disclosures[key]),
      rows: members,
      title: node.title,
      variants: variants.map((variant) =>
        navLink(
          variant,
          depth + 1,
          !navLeafVisible(variant, selection, context),
          source,
        ),
      ),
    },
  };
}

/**
 * Whether an entry's list holds a row that the selected filter can show,
 * before search narrows it. All lists no removed row, so a current parent
 * whose variants are all removed has no list there. Changes keeps every
 * list, so that parent still opens one.
 */
function listShows(
  node: NavLeafNode,
  view: "all" | "changes",
  context: NavigationContext,
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
