import { COMPONENT_NAVIGATION } from "../../../parts/component_nav_data.js";
import { ENTRY_PATHS } from "../../../parts/entry_paths.js";
import type { NavNode } from "../../../parts/nav.js";
import type { CatalogueView } from "../../parts/catalogue.js";
import { CANVAS_ENTRIES, type CanvasEntry } from "../../parts/entries.js";
import { CANVAS_ALL_ROWS, retarget } from "../../parts/nav_rows.js";

import { EVIDENCE_PAGES as E } from "./destinations.js";

/*
 * The branches that the Comparison evidence artboards depict beside the
 * canonical one. Each changed a stylesheet, apart from the excluded content
 * branch, whose only change lies in Welcome's navigation. Each branch is a
 * story of its own, so a catalogue row opens only an artboard of its story,
 * and every other row is a picture.
 */

/** An unmodified entry: no status pill, and Inspect alone in its panel. */
function unmodified(entry: CanvasEntry): CanvasEntry {
  return { ...entry, status: undefined, changed: false };
}

/** The entries of these branches that differ from the canonical branch. */
export const EVIDENCE_ENTRIES = {
  /** Details on the styles branch, which links only the excluded stylesheet. */
  details: unmodified(CANVAS_ENTRIES.details),
  /** Welcome on the excluded content branch. */
  welcome: unmodified(CANVAS_ENTRIES.welcome),
  /** The Getting started page, which the handbook branch changed. */
  page: {
    title: "Getting started",
    slug: "getting-started",
    path: ENTRY_PATHS.gettingStarted,
    kind: "document",
    status: "changed",
    changed: true,
  },
} as const satisfies Record<string, CanvasEntry>;

/** The canonical tree in All, with every row a picture. */
const QUIET_ROWS: readonly NavNode[] = CANVAS_ALL_ROWS.map((row) =>
  retarget(row, undefined),
);

/** The styles branch in All: Welcome carries the changed mark. */
const STYLES_ALL_ROWS: readonly NavNode[] = QUIET_ROWS.map((row) =>
  row.key === "welcome" ? { ...row, changed: true } : row,
);

/** Welcome alone in the Changes filter, as each styles branch lists it. */
const STYLES_CHANGES_ROWS: readonly NavNode[] = [
  { key: "example", depth: 0, kind: "folder", label: "Example", open: true },
  { key: "screens", depth: 1, kind: "folder", label: "Screens", open: true },
  {
    key: "welcome",
    changed: true,
    depth: 2,
    kind: "screen",
    label: "Welcome",
  },
];

/**
 * The handbook branch in the Changes filter: the Getting started page under
 * Example, and the Action with its three saved variants under Example's
 * Components, each changed.
 */
const HANDBOOK_ROWS: readonly NavNode[] = [
  { key: "example", depth: 0, kind: "folder", label: "Example", open: true },
  {
    key: "getting-started",
    changed: true,
    depth: 1,
    kind: "page",
    label: "Getting started",
  },
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
    label: COMPONENT_NAVIGATION.action.title,
    variants: "open",
  },
  ...COMPONENT_NAVIGATION.action.variants.map((variant): NavNode => ({
    key: variant.id,
    changed: true,
    depth: 3,
    kind: "variant",
    label: variant.title,
    variantParentKind: "component",
  })),
];

/** The number of entries that a Changes filter lists, by its rows. */
function changesCount(rows: readonly NavNode[]): number {
  return rows.filter((row) => row.kind !== "folder").length;
}

/** Each branch's count of changes, as the Changes filter and the stepper show it. */
export const BRANCH_CHANGES = {
  /** Welcome alone, on each branch whose changed stylesheet reaches it. */
  styles: changesCount(STYLES_CHANGES_ROWS),
  /** Getting started, then the Action and its three saved variants. */
  handbook: changesCount(HANDBOOK_ROWS),
  /** None, on the Action's stylesheet branch and the excluded content branch. */
  quiet: 0,
} as const;

/** A styles branch in the Changes filter, with Welcome selected. */
export const STYLES_CHANGES: CatalogueView = {
  filter: "changes",
  activeKey: "welcome",
  rows: STYLES_CHANGES_ROWS,
  changedCount: BRANCH_CHANGES.styles,
};

/**
 * The styles branch in All, with the entry of the given row selected.
 * Details opens its own state, where it keeps its evidence in Inspect.
 */
export function stylesAll(activeKey: "details" | "welcome"): CatalogueView {
  return {
    filter: "all",
    activeKey,
    rows: STYLES_ALL_ROWS,
    targets: { details: E.evidenceUnchanged },
    changedCount: BRANCH_CHANGES.styles,
  };
}

/** A branch without Changes rows in All, with the given row selected. */
export function quietAll(activeKey: string): CatalogueView {
  return {
    filter: "all",
    activeKey,
    rows: QUIET_ROWS,
    changedCount: BRANCH_CHANGES.quiet,
  };
}

/** The handbook branch in the Changes filter, with Getting started selected. */
export const HANDBOOK_CHANGES: CatalogueView = {
  filter: "changes",
  activeKey: "getting-started",
  rows: HANDBOOK_ROWS,
  changedCount: BRANCH_CHANGES.handbook,
};
