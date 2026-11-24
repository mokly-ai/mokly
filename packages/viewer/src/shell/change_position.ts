/**
 * The change stepper's data under the
 * [Changes tab](../../../../docs/protocol/mokly-changes-controls.md#changes-tab):
 * the routed entry's place among the entries that the Changes filter lists,
 * in the filter's order, and the entries before and after it. The Changes
 * filter alone defines the list: the reader's search and tags never narrow
 * it, so its length is the Changes count.
 */

import type { ShellContext } from "./context.js";
import { navLeafVisible } from "./nav_model.js";
import type { NavLeafNode, NavNode, NavSectionNode } from "./nav_tree.js";
import { routeHref } from "./routes.js";

/** An entry that a step of the change stepper opens. */
export interface ChangeStepTarget {
  entryId: string;
  /** The exact removed record, for a removed row. */
  snapshotId?: string | undefined;
  /** The in-shell address of the entry, as its catalogue row links it. */
  href: string;
}

/** The routed entry's place in the list of the Changes filter. */
export interface ChangePosition {
  /** The entry's place among the entries that the Changes filter lists, from 1. */
  position: number;
  /** How many entries the Changes filter lists. */
  total: number;
  /** The entry before it, absent for the first entry. */
  previous?: ChangeStepTarget | undefined;
  /** The entry after it, absent for the last entry. */
  next?: ChangeStepTarget | undefined;
}

/** The Changes filter without a search or tags. */
const CHANGES_FILTER = { view: "changes", search: "", tags: [] } as const;

/**
 * The routed entry's place among the entries that the Changes filter lists,
 * or nothing while Changes is not ready and for an entry that the filter does
 * not list, such as an unmodified container row. A removed entry matches its
 * row by its path and, when the route names one, by its snapshot.
 */
export function changePosition(
  sections: readonly NavSectionNode[],
  context: ShellContext,
  entry: { path: string; snapshotId?: string | undefined },
): ChangePosition | undefined {
  if (!context.changedEntries) return undefined;
  const listed = sections
    .flatMap(({ children }) => children.flatMap(treeRows))
    .filter((row) => navLeafVisible(row, CHANGES_FILTER, context));
  const index = listed.findIndex(
    (row) =>
      row.entryId === entry.path &&
      (entry.snapshotId === undefined || row.snapshotId === entry.snapshotId),
  );
  if (index === -1) return undefined;
  const previous = listed[index - 1];
  const next = listed[index + 1];
  return {
    position: index + 1,
    total: listed.length,
    ...(previous ? { previous: stepTarget(previous) } : {}),
    ...(next ? { next: stepTarget(next) } : {}),
  };
}

/**
 * A node's leaf rows in the built tree's row order: a folder's children in
 * order; a row, then its variants, which end with the removed variants
 * attached to it, then its members, each with the rows that it holds.
 */
function treeRows(node: NavNode): NavLeafNode[] {
  return node.kind === "group"
    ? node.children.flatMap(treeRows)
    : [
        node,
        ...(node.variants ?? []),
        ...(node.members ?? []).flatMap(treeRows),
      ];
}

/** The entry of one listed row, at the address that its catalogue row links. */
function stepTarget(row: NavLeafNode): ChangeStepTarget {
  const snapshot = row.snapshotId;
  return {
    entryId: row.entryId,
    ...(snapshot === undefined ? {} : { snapshotId: snapshot }),
    href: routeHref(
      row.entryId,
      undefined,
      snapshot === undefined ? {} : { snapshot },
    ),
  };
}
