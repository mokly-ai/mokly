import type { CatalogueNavigationProps } from "../../library/chrome/catalogue-navigation.js";
import { MOVED_ROWS } from "../../parts/account_nav_data.js";
import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { DesignDestination } from "../../parts/destinations.js";
import { NAV_TREE, REMOVED_SCREEN_ROWS } from "../../parts/nav_data.js";

import { CANVAS_PAGES } from "./destinations.js";

type NavigationRows = CatalogueNavigationProps["rows"];
type NavigationRow = NavigationRows[number];

/**
 * The rows that open a Canvas artboard from All. Every other row is a
 * picture of itself, because Canvas links stay inside the Canvas family.
 */
const ALL_TARGETS: Readonly<Record<string, DesignDestination>> = {
  welcome: CANVAS_PAGES.overview,
  profile: CANVAS_PAGES.unchanged,
  [COMPONENT_NAVIGATION.action.id]: CANVAS_PAGES.componentSet,
  "payment-terms": CANVAS_PAGES.document,
};

/** A row with the given destination, or without one. */
function retarget(
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
 * The canonical branch in the Changes filter, as the shipped tree draws it:
 * Welcome changed, Details added, the billing entries moved under Account,
 * and five screens removed, ten entries in all. The changed and the added
 * rows carry the changed mark; a moved or removed row names its state
 * instead. Welcome opens the Changes filter with Welcome selected; the other
 * rows are pictures.
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
  { key: "details", changed: true, depth: 2, kind: "screen", label: "Details" },
  ...MOVED_ROWS.map((row) => retarget(row, undefined)),
  ...REMOVED_SCREEN_ROWS.map((entry) => ({
    key: entry.key,
    depth: 0,
    kind: "screen" as const,
    label: `${entry.title} · Removed`,
  })),
];
