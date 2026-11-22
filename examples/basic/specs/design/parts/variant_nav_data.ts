import type { CatalogueNavigationProps } from "../library/chrome/catalogue-navigation.js";

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
 * unmodified: the parent keeps its aggregate mark. No artboard shows the
 * changed variant, so the row is a picture.
 */
export const CHANGED_VARIANT_ROWS: NavigationRows = [
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
