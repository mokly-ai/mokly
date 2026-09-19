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
} as const satisfies Record<string, RemovedScreen>;

export const REMOVED_SCREEN_ROWS = Object.values(REMOVED_SCREENS);

/** Welcome changed, Details was added, and four screens were removed. */
export const CHANGED_COUNT = 2 + REMOVED_SCREEN_ROWS.length;

export const NAV_TREE = [
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
  },
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
  { key: "browse-shell", depth: 1, kind: "collection", label: "Browse shell" },
  { key: "changes", depth: 1, kind: "collection", label: "Changes" },
] as const satisfies CatalogueNavigationProps["rows"];
