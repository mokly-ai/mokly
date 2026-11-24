import type { CatalogueNavigationProps } from "../../library/chrome/catalogue-navigation.js";
import { MOVED_ROWS } from "../../parts/account_nav_data.js";
import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { DesignDestination } from "../../parts/destinations.js";
import {
  NAV_TREE,
  REMOVED_SCREEN_ROWS,
  REMOVED_SCREENS,
} from "../../parts/nav_data.js";

import { CANVAS_PAGES } from "./destinations.js";

type NavigationRows = CatalogueNavigationProps["rows"];
type NavigationRow = NavigationRows[number];

/**
 * The rows that open a Canvas artboard from All. Every other row is a
 * picture of itself, because Canvas links stay inside the Canvas family.
 */
const ALL_TARGETS: Readonly<Record<string, DesignDestination>> = {
  welcome: CANVAS_PAGES.overview,
  details: CANVAS_PAGES.added,
  profile: CANVAS_PAGES.unchanged,
  [COMPONENT_NAVIGATION.action.id]: CANVAS_PAGES.componentSet,
  [COMPONENT_NAVIGATION.toolbar.id]: CANVAS_PAGES.componentSetToolbar,
  "payment-terms": CANVAS_PAGES.document,
  "example/tour": CANVAS_PAGES.useCase,
};

/** A row with the given destination, or without one. */
export function retarget(
  row: NavigationRow,
  to: DesignDestination | undefined,
): NavigationRow {
  const { to: _to, ...rest } = row;
  return to === undefined ? rest : { ...rest, to };
}

/** The canonical catalogue in All, its rows opening Canvas artboards. */
export const CANVAS_ALL_ROWS: NavigationRows = NAV_TREE.map((row) =>
  retarget(row, ALL_TARGETS[row.key]),
);

/**
 * The moved rows that open a Canvas artboard: Invoice opens its moved
 * outcome on the Changes tab, and Payment terms, which has no Changes
 * artboard, opens its reading frame. No artboard shows the Overdue
 * variant, so its row is a picture.
 */
const MOVED_TARGETS: Readonly<Record<string, DesignDestination>> = {
  invoice: CANVAS_PAGES.moved,
  "payment-terms": CANVAS_PAGES.document,
};

/**
 * The removed rows, each opening its screen's previous version: Farewell on
 * its Changes tab, as Invoice's row opens its own, and each other screen in
 * the one state that its artboard shows.
 */
const REMOVED_TARGETS: Readonly<Record<string, DesignDestination>> = {
  [REMOVED_SCREENS.farewell.key]: CANVAS_PAGES.removed,
  [REMOVED_SCREENS.survey.key]: CANVAS_PAGES.removedLong,
  [REMOVED_SCREENS.invite.key]: CANVAS_PAGES.removedLoading,
  [REMOVED_SCREENS.archive.key]: CANVAS_PAGES.removedUnavailable,
  [REMOVED_SCREENS.timeline.key]: CANVAS_PAGES.removedNoView,
};

/**
 * The canonical branch in the Changes filter, as the shipped tree draws it,
 * in folder order: Welcome changed and Details added under Screens, the
 * Example tour, whose steps name both screens, after the Screens folder, the
 * billing entries moved under Account, and five screens removed, eleven
 * entries in all. The changed, the added and the use case's rows carry the
 * changed mark; a moved or removed row names its state instead. Welcome
 * opens the Changes filter with Welcome selected, Details opens the added
 * entry, the tour opens its Changes tab, and the moved and the removed rows
 * open their artboards.
 */
export const CANVAS_CHANGES_ROWS: NavigationRows = [
  {
    key: "example",
    depth: 0,
    kind: "folder",
    label: "Example",
    open: true,
  },
  {
    key: "screens",
    depth: 1,
    kind: "folder",
    label: "Screens",
    open: true,
  },
  {
    key: "welcome",
    changed: true,
    depth: 2,
    kind: "screen",
    label: "Welcome",
    to: CANVAS_PAGES.catalogue,
  },
  {
    key: "details",
    changed: true,
    depth: 2,
    kind: "screen",
    label: "Details",
    to: CANVAS_PAGES.added,
  },
  {
    key: "example/tour",
    changed: true,
    depth: 1,
    kind: "flow",
    label: "Example tour",
    to: CANVAS_PAGES.useCaseChanges,
  },
  ...MOVED_ROWS.map((row) => retarget(row, MOVED_TARGETS[row.key])),
  ...REMOVED_SCREEN_ROWS.map((entry) =>
    retarget(
      {
        key: entry.key,
        depth: 0,
        kind: "screen",
        label: `${entry.title} · Removed`,
      },
      REMOVED_TARGETS[entry.key],
    ),
  ),
];

/**
 * The place of a row's change among the canonical branch's changes, as the
 * change stepper counts it: in the Changes filter's order, folders left out.
 */
export function changePosition(key: string): number {
  const changes = CANVAS_CHANGES_ROWS.filter((row) => row.kind !== "folder");
  return changes.findIndex((row) => row.key === key) + 1;
}
