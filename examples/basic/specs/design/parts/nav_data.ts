import { COMPONENT_PAGES } from "../components/parts/destinations.js";
import type { CatalogueNavigationProps } from "../library/chrome/catalogue-navigation.js";

import {
  MOVED_COUNT,
  accountBranch,
  type ProfileList,
} from "./account_nav_data.js";
import {
  COMPONENT_NAVIGATION,
  componentVariantRows,
} from "./component_nav_data.js";
import { DESTINATIONS, type DesignDestination } from "./destinations.js";

/** One screen this branch removed, with the preview state it opens in. */
interface RemovedScreen {
  design: DesignDestination;
  key: string;
  /** The path the screen had at the branch point. */
  path: string;
  title: string;
}

/**
 * The screens this branch removed. Each keeps its own Changes row, so the
 * previous-version states are reached the way a reader reaches them.
 */
export const REMOVED_SCREENS = {
  farewell: {
    design: DESTINATIONS.removed,
    key: "farewell-removed",
    path: "example/screens/farewell",
    title: "Farewell",
  },
  survey: {
    design: DESTINATIONS.removedLong,
    key: "survey-removed",
    path: "example/screens/survey",
    title: "Survey",
  },
  invite: {
    design: DESTINATIONS.removedLoading,
    key: "invite-removed",
    path: "example/screens/invite",
    title: "Invite",
  },
  archive: {
    design: DESTINATIONS.removedUnavailable,
    key: "archive-removed",
    path: "example/screens/archive",
    title: "Archive",
  },
  timeline: {
    design: DESTINATIONS.removedNoView,
    key: "timeline-removed",
    path: "example/screens/timeline",
    title: "Timeline",
  },
} as const satisfies Record<string, RemovedScreen>;

export const REMOVED_SCREEN_ROWS = Object.values(REMOVED_SCREENS);

/**
 * Welcome changed, Details was added, three billing entries moved under
 * Account, and five screens were removed.
 */
export const CHANGED_COUNT = 2 + MOVED_COUNT + REMOVED_SCREEN_ROWS.length;

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
    variantParentKind: "screen",
  },
  {
    key: "welcome-error",
    depth: 3,
    kind: "variant",
    label: "Save failed",
    variantParentKind: "screen",
  },
];

/**
 * The whole depicted catalogue as one tree in folder order. Example holds
 * both kinds, so it appears in Specs and in Components with that section's
 * children. Its README is the folder's own page and its first row, labelled
 * Overview because its title is the folder's title. Top-level folders follow
 * the catalogue's order record, which names Example first.
 */
function catalogueTree(
  variants: "closed" | "open",
  profile: ProfileList = "closed",
): NavigationRows {
  return [
    {
      key: "example",
      depth: 0,
      kind: "folder",
      label: "Example",
      open: true,
    },
    {
      key: "example-overview",
      depth: 1,
      kind: "document",
      label: "Overview",
      to: DESTINATIONS.exampleOverview,
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
      depth: 2,
      kind: "component",
      label: COMPONENT_NAVIGATION.action.title,
      to: COMPONENT_PAGES.default,
      variants: "open",
    },
    ...componentVariantRows("action", 3),
    {
      key: COMPONENT_NAVIGATION.toolbar.id,
      depth: 2,
      kind: "component",
      label: COMPONENT_NAVIGATION.toolbar.title,
      to: COMPONENT_PAGES.toolbar,
      variants: "open",
    },
    ...componentVariantRows("toolbar", 3),
    {
      key: "screens",
      depth: 1,
      kind: "folder",
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
      key: "example/tour",
      depth: 1,
      kind: "flow",
      label: "Example tour",
      to: DESTINATIONS.tour,
    },
    {
      key: "getting-started",
      depth: 1,
      kind: "page",
      label: "Getting started",
      to: DESTINATIONS.page,
    },
    ...accountBranch(profile),
    {
      key: "design",
      depth: 0,
      kind: "folder",
      label: "Design",
      open: true,
    },
    {
      key: "browse-shell",
      depth: 1,
      kind: "folder",
      label: "Browse shell",
    },
    { key: "changes", depth: 1, kind: "folder", label: "Changes" },
  ];
}

/** The canonical catalogue fixture, with Welcome's variant list collapsed. */
export const NAV_TREE: NavigationRows = catalogueTree("closed");

/** The same catalogue with Welcome's variant list disclosed. */
export const NAV_TREE_VARIANTS_OPEN: NavigationRows = catalogueTree("open");

/** The same catalogue with the Profile folder's screen row disclosed. */
export const NAV_TREE_PROFILE_OPEN: NavigationRows = catalogueTree(
  "closed",
  "open",
);
