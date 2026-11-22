import { COMPONENT_NAVIGATION } from "../../../parts/component_nav_data.js";
import type { NavNode } from "../../../parts/nav.js";
import type { CatalogueView } from "../../parts/catalogue.js";
import { COMPONENT_IDENTITIES } from "../../parts/component_identity.js";
import { CANVAS_ENTRIES, type CanvasEntry } from "../../parts/entries.js";
import { CANVAS_ALL_ROWS, retarget } from "../../parts/nav_rows.js";

/*
 * The three branches that the Component explorer artboards depict beside the
 * canonical one. On the Action branch, the Action's render changed the
 * corner radius and the padding of its button, so the Action and its three
 * saved variants each changed: four Changes rows. Welcome and Details render
 * the Action, so the change affects them, but they stay outside Changes. On
 * the direct-change branch, the Action changed in the same way, and Welcome
 * also changed the label that it gives its own Action, so Welcome keeps a
 * Changes row of its own: five Changes rows. On the removal branch, the
 * Action's saved variant Compact was removed: one Changes row. Each branch is
 * a story of its own, so a catalogue row opens only an artboard of its story,
 * and every other row is a picture.
 */

const { action: ACTION } = COMPONENT_IDENTITIES;

/** The Action's saved variant Default on the Action branch, which changed. */
export const CHANGED_DEFAULT: CanvasEntry = {
  title: ACTION.title,
  slug: "action",
  path: `${ACTION.path}/default`,
  kind: "component",
  status: "changed",
  changed: true,
};

/** The Action's saved variant Compact, which the removal branch removed. */
export const REMOVED_COMPACT: CanvasEntry = {
  title: ACTION.title,
  slug: "action",
  path: `${ACTION.path}/compact`,
  kind: "component",
  status: "removed",
  changed: true,
};

/**
 * Welcome and Details on the Action branch: unmodified and outside Changes,
 * yet their comparison is eligible, because the changed Action renders in
 * them, so their right panel has Changes.
 */
export const AFFECTED_ENTRIES = {
  welcome: { ...CANVAS_ENTRIES.welcome, status: undefined, changed: true },
  details: { ...CANVAS_ENTRIES.details, status: undefined, changed: true },
} as const satisfies Record<string, CanvasEntry>;

/** The key of a row of the Action's saved variants, by its slug. */
const variantKey = (slug: string) =>
  `${COMPONENT_NAVIGATION.action.id}/${slug}`;

/** The keys of the rows that the explorer artboards select. */
export const EXPLORER_KEYS = {
  default: variantKey("default"),
  compact: variantKey("compact"),
} as const;

/** Example's folder, which holds its screens and its Components library. */
const EXAMPLE_ROW: NavNode = {
  key: "example",
  depth: 0,
  kind: "folder",
  label: "Example",
  open: true,
};

/** Example's Components folder over the Action's row, in the Changes filter. */
const ACTION_ROWS: readonly NavNode[] = [
  {
    key: "example-components",
    depth: 1,
    kind: "folder",
    label: "Components",
    open: true,
  },
  {
    key: COMPONENT_NAVIGATION.action.id,
    changed: true,
    depth: 2,
    kind: "component",
    label: ACTION.title,
    variants: "open",
  },
];

/** One of the Action's saved variants under its row. */
function variantRow(slug: string, label: string, changed: boolean): NavNode {
  return {
    key: variantKey(slug),
    ...(changed ? { changed } : {}),
    depth: 3,
    kind: "variant",
    label,
    variantParentKind: "component",
  };
}

/** The Action's three saved variants under its row, each changed. */
const CHANGED_VARIANT_ROWS: readonly NavNode[] = [
  variantRow("default", "Default", true),
  variantRow("disabled", "Disabled", true),
  variantRow("secondary", "Secondary", true),
];

/**
 * The Action branch in the Changes filter: the Action and its three saved
 * variants, each changed.
 */
const ACTION_BRANCH_ROWS: readonly NavNode[] = [
  EXAMPLE_ROW,
  ...ACTION_ROWS,
  ...CHANGED_VARIANT_ROWS,
];

/**
 * The direct-change branch in the Changes filter: Welcome under Example's
 * Screens, then the Action and its three saved variants, each changed.
 */
const DIRECT_BRANCH_ROWS: readonly NavNode[] = [
  EXAMPLE_ROW,
  { key: "screens", depth: 1, kind: "folder", label: "Screens", open: true },
  { key: "welcome", changed: true, depth: 2, kind: "screen", label: "Welcome" },
  ...ACTION_ROWS,
  ...CHANGED_VARIANT_ROWS,
];

/**
 * The removal branch in the Changes filter: the removed Compact under the
 * Action, which carries the aggregate mark. A removed row names its state
 * and takes no changed mark.
 */
const REMOVAL_BRANCH_ROWS: readonly NavNode[] = [
  EXAMPLE_ROW,
  ...ACTION_ROWS,
  variantRow("compact", "Compact · Removed", false),
];

/**
 * Each branch's changes in the Changes filter's order, as the stepper counts
 * them: the Action, then Default, Disabled, and Secondary on the Action
 * branch; Welcome, which Specs lists first, then the same four on the
 * direct-change branch; and the removed Compact alone on the removal branch.
 */
export const BRANCH_CHANGES = {
  action: { total: 4, defaultPosition: 2 },
  direct: { total: 5, welcomePosition: 1 },
  removal: { total: 1, compactPosition: 1 },
} as const;

/** The catalogue of the Action branch in the Changes filter. */
export function actionBranchChanges(activeKey: string): CatalogueView {
  return {
    filter: "changes",
    activeKey,
    rows: ACTION_BRANCH_ROWS,
    changedCount: BRANCH_CHANGES.action.total,
  };
}

/** The catalogue of the Action branch in All, with every other row a picture. */
export function actionBranchAll(activeKey: string): CatalogueView {
  return {
    filter: "all",
    activeKey,
    rows: CANVAS_ALL_ROWS.map((row) => retarget(row, undefined)),
    changedCount: BRANCH_CHANGES.action.total,
  };
}

/**
 * The catalogue of the direct-change branch in the Changes filter, with
 * Welcome selected. No other artboard depicts this branch, so every other row
 * is a picture.
 */
export const DIRECT_CHANGES: CatalogueView = {
  filter: "changes",
  activeKey: "welcome",
  rows: DIRECT_BRANCH_ROWS,
  changedCount: BRANCH_CHANGES.direct.total,
};

/** The catalogue of the removal branch in the Changes filter. */
export const REMOVAL_CHANGES: CatalogueView = {
  filter: "changes",
  activeKey: EXPLORER_KEYS.compact,
  rows: REMOVAL_BRANCH_ROWS,
  changedCount: BRANCH_CHANGES.removal.total,
};

/**
 * The zoom that fits the removal branch's variant set, whose fourth row is
 * the removed Compact, so it fits below 100%.
 */
export const REMOVED_FIT = 88;
