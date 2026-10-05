import type { CatalogueNavigationProps } from "../library/chrome/catalogue-navigation.js";

import { DESTINATIONS } from "./destinations.js";

type NavigationRows = CatalogueNavigationProps["rows"];

/**
 * Changes-filtered views of Welcome's variant group. Each scenario holds only
 * the rows its Changes filter keeps, beneath the Example and Screens folders.
 */
const WELCOME_BRANCH: NavigationRows = [
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
];

/**
 * Changes holding one changed variant under a parent whose own render is
 * unmodified: the parent keeps its aggregate mark and opens the changed variant.
 */
export const CHANGED_VARIANT_ROWS: NavigationRows = [
  ...WELCOME_BRANCH,
  {
    key: "welcome",
    changed: true,
    depth: 2,
    kind: "screen",
    label: "Welcome",
    to: DESTINATIONS.variantChanges,
    variants: "open",
  },
  {
    key: "welcome-error",
    changed: true,
    depth: 3,
    kind: "variant",
    label: "Save failed",
    variantParentKind: "screen",
  },
];

/** The same group after the changed variant was deleted on this branch. */
export const REMOVED_VARIANT_ROWS: NavigationRows = [
  ...WELCOME_BRANCH,
  {
    key: "welcome",
    changed: true,
    depth: 2,
    kind: "screen",
    label: "Welcome",
    variants: "open",
  },
  {
    key: "welcome-error",
    depth: 3,
    kind: "variant",
    label: "Save failed · Removed",
    variantParentKind: "screen",
  },
];

/** Changes shows only the removed route when its former parent is unmodified. */
export const REPARENTED_REMOVED_VARIANT_ROWS: NavigationRows = [
  {
    key: "welcome-error-removed",
    depth: 0,
    kind: "screen",
    label: "Save failed · Removed",
  },
];

/** Changes holding Welcome alone, because only one of its views changed. */
export const CHANGED_VIEW_ROWS: NavigationRows = [
  ...WELCOME_BRANCH,
  {
    key: "welcome",
    changed: true,
    depth: 2,
    kind: "screen",
    label: "Welcome",
    to: DESTINATIONS.changedViews,
  },
];
