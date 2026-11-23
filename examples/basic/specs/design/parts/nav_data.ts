import { CANVAS_PAGES } from "../canvas/parts/destinations.js";
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
/** One screen this branch removed. */
interface RemovedScreen {
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
    key: "farewell-removed",
    path: "example/screens/farewell",
    title: "Farewell",
  },
  survey: {
    key: "survey-removed",
    path: "example/screens/survey",
    title: "Survey",
  },
  invite: {
    key: "invite-removed",
    path: "example/screens/invite",
    title: "Invite",
  },
  archive: {
    key: "archive-removed",
    path: "example/screens/archive",
    title: "Archive",
  },
  timeline: {
    key: "timeline-removed",
    path: "example/screens/timeline",
    title: "Timeline",
  },
} as const satisfies Record<string, RemovedScreen>;

export const REMOVED_SCREEN_ROWS = Object.values(REMOVED_SCREENS);

/**
 * Welcome changed, Details was added, the Example tour changed because its
 * steps name both screens, three billing entries moved under Account, and
 * five screens were removed: eleven changes.
 */
export const CHANGED_COUNT = 3 + MOVED_COUNT + REMOVED_SCREEN_ROWS.length;

type NavigationRows = CatalogueNavigationProps["rows"];

/**
 * Welcome's depicted variants. No artboard shows them from All, so their rows
 * are depictions.
 */
const WELCOME_VARIANTS: NavigationRows = [
  {
    key: "welcome-empty",
    depth: 3,
    kind: "variant",
    label: "Empty workspace",
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
 * the catalogue's order record, which names Example first. A row opens the
 * Canvas artboard of its entry, and a row whose entry no artboard shows, such
 * as the README and the Getting started page, is a picture of itself.
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
      to: CANVAS_PAGES.componentSet,
      variants: "open",
    },
    ...componentVariantRows("action", 3),
    {
      key: COMPONENT_NAVIGATION.toolbar.id,
      depth: 2,
      kind: "component",
      label: COMPONENT_NAVIGATION.toolbar.title,
      to: CANVAS_PAGES.componentSetToolbar,
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
      to: CANVAS_PAGES.overview,
      variants,
    },
    ...WELCOME_VARIANTS,
    {
      key: "details",
      depth: 2,
      kind: "screen",
      label: "Details",
      to: CANVAS_PAGES.added,
    },
    {
      key: "example/tour",
      depth: 1,
      kind: "flow",
      label: "Example tour",
      to: CANVAS_PAGES.useCase,
    },
    {
      key: "getting-started",
      depth: 1,
      kind: "page",
      label: "Getting started",
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
