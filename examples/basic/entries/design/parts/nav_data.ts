import { COMPONENT_PAGES } from "../components/parts/destinations.js";
import type { CatalogueNavigationProps } from "../library/chrome/catalogue-navigation.js";

import { DESTINATIONS, type DesignDestination } from "./destinations.js";

/** One screen this branch removed, with the preview state it opens in. */
interface RemovedScreen {
  design: DesignDestination;
  id: string;
  key: string;
  title: string;
}

/**
 * The screens this branch removed. Each keeps its own Changes row, so the
 * previous-version states are reached the way a reader reaches them.
 */
export const REMOVED_SCREENS = {
  farewell: {
    design: DESTINATIONS.removed,
    id: "example-farewell",
    key: "farewell-removed",
    title: "Farewell",
  },
  survey: {
    design: DESTINATIONS.removedLong,
    id: "example-survey",
    key: "survey-removed",
    title: "Survey",
  },
  invite: {
    design: DESTINATIONS.removedLoading,
    id: "example-invite",
    key: "invite-removed",
    title: "Invite",
  },
  archive: {
    design: DESTINATIONS.removedUnavailable,
    id: "example-archive",
    key: "archive-removed",
    title: "Archive",
  },
  timeline: {
    design: DESTINATIONS.removedNoView,
    id: "example-timeline",
    key: "timeline-removed",
    title: "Timeline",
  },
} as const satisfies Record<string, RemovedScreen>;

export const REMOVED_SCREEN_ROWS = Object.values(REMOVED_SCREENS);

/** Welcome changed, Details was added, and five screens were removed. */
export const CHANGED_COUNT = 2 + REMOVED_SCREEN_ROWS.length;

type NavigationRows = CatalogueNavigationProps["rows"];

/**
 * Welcome's depicted variants. `Empty workspace` owns a catalogue destination;
 * `Save failed` stays a depiction outside the Changes artboards that select it.
 */
const WELCOME_VARIANTS: NavigationRows = [
  {
    key: "welcome-empty",
    depth: 3,
    kind: "variant",
    label: "Empty workspace",
    to: DESTINATIONS.variantSelected,
  },
  { key: "welcome-error", depth: 3, kind: "variant", label: "Save failed" },
];

function catalogueTree(variants: "closed" | "open"): NavigationRows {
  return [
    {
      key: "example",
      count: 4,
      depth: 0,
      kind: "collection",
      label: "Example",
      open: true,
    },
    {
      key: "screens",
      count: 2,
      depth: 1,
      kind: "collection",
      label: "Screens",
      open: true,
    },
    {
      key: "welcome",
      depth: 2,
      kind: "screen",
      label: "Welcome",
      to: DESTINATIONS.welcome,
      variants,
    },
    ...WELCOME_VARIANTS,
    {
      key: "details",
      depth: 2,
      kind: "screen",
      label: "Details",
      to: DESTINATIONS.details,
    },
    {
      key: "example-tour",
      depth: 1,
      kind: "flow",
      label: "Example tour",
      to: DESTINATIONS.tour,
    },
    {
      key: "example-components",
      count: 2,
      depth: 1,
      kind: "collection",
      label: "Components",
      open: true,
    },
    {
      key: "action",
      depth: 2,
      kind: "component",
      label: "Action",
      to: COMPONENT_PAGES.default,
    },
    {
      key: "toolbar",
      depth: 2,
      kind: "component",
      label: "Toolbar",
      to: COMPONENT_PAGES.toolbar,
    },
    {
      key: "design",
      count: 2,
      depth: 0,
      kind: "collection",
      label: "Design",
      open: true,
    },
    {
      key: "browse-shell",
      depth: 1,
      kind: "collection",
      label: "Browse shell",
    },
    { key: "changes", depth: 1, kind: "collection", label: "Changes" },
  ];
}

/** The canonical catalogue fixture, with Welcome's variant list collapsed. */
export const NAV_TREE: NavigationRows = catalogueTree("closed");

/** The same catalogue with Welcome's variant list disclosed. */
export const NAV_TREE_VARIANTS_OPEN: NavigationRows = catalogueTree("open");

const WELCOME_BRANCH: NavigationRows = [
  {
    key: "example",
    depth: 0,
    kind: "collection",
    label: "Example",
    open: true,
  },
  {
    key: "screens",
    depth: 1,
    kind: "collection",
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
    variants: "closed",
  },
];
