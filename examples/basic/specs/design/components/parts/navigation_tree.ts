import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { NavNode } from "../../parts/nav.js";

import { COMPONENT_PAGES, INSPECTION_PAGES } from "./destinations.js";

/** The navigation key of the removed Compact variant's row. */
export const REMOVED_VARIANT_KEY = "example-action-compact";

/** The rows under Example, from depth 0, before the folder nests them. */
const MEMBERS: readonly NavNode[] = [
  {
    key: "screens",
    depth: 0,
    kind: "folder",
    label: "Screens",
    count: 1,
    open: true,
  },
  {
    key: "selected-screen",
    depth: 1,
    kind: "screen",
    label: "Farewell",
    to: INSPECTION_PAGES["removed-consumer"],
  },
  {
    key: "components",
    depth: 0,
    kind: "folder",
    label: "Components",
    count: 1,
    open: true,
  },
  {
    key: COMPONENT_NAVIGATION.action.id,
    changed: true,
    depth: 1,
    kind: "component",
    label: COMPONENT_NAVIGATION.action.title,
    to: COMPONENT_PAGES.removed,
    variants: "open",
  },
  {
    key: REMOVED_VARIANT_KEY,
    depth: 2,
    kind: "variant",
    label: "Compact · Removed",
    to: COMPONENT_PAGES.removed,
    variantParentKind: "component",
  },
];

/**
 * The explorer's catalogue in Changes on a branch that removed Action's
 * Compact variant and Farewell, the screen that consumed it. The catalogue is
 * one tree under the Example folder, so Example holds Screens and the
 * component library, and Changes keeps only the changed rows and their
 * folders: Farewell, and Action with its removed variant.
 */
export const REMOVED_STORY_NODES: readonly NavNode[] = [
  {
    key: "example",
    depth: 0,
    kind: "folder",
    label: "Example",
    open: true,
  },
  ...MEMBERS.map((row) => ({ ...row, depth: row.depth + 1 })),
];
