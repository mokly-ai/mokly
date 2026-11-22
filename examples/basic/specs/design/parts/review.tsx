import { CANVAS_PAGES } from "../canvas/parts/destinations.js";

import { MOVED_ROWS } from "./account_nav_data.js";
import type { DesignDestination } from "./destinations.js";
import { NavTree, type NavNode } from "./nav.js";
import { REMOVED_SCREEN_ROWS } from "./nav_data.js";

const CHANGED_NODES: readonly NavNode[] = [
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
    depth: 2,
    kind: "screen",
    label: "Welcome",
    to: CANVAS_PAGES.changesCurrent,
  },
  {
    key: "details",
    depth: 2,
    kind: "screen",
    label: "Details",
    to: CANVAS_PAGES.addedChanges,
  },
  ...MOVED_ROWS,
  ...REMOVED_SCREEN_ROWS.map((entry) => ({
    key: entry.key,
    depth: 0,
    kind: "screen" as const,
    label: `${entry.title} · Removed`,
    to: entry.design,
  })),
];

/** Changes uses the same catalogue navigation and filter as All. */
export function ReviewNav({
  activeDestination,
  activeTitle,
}: {
  activeDestination?: DesignDestination | undefined;
  activeTitle?: string | undefined;
}) {
  return (
    <NavTree
      activeDestination={activeDestination}
      activeLabel={activeTitle}
      changedOnly
      nodes={CHANGED_NODES}
    />
  );
}
