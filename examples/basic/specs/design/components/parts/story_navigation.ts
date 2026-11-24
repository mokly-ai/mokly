import {
  COMPONENT_NAVIGATION,
  componentVariantRows,
} from "../../parts/component_nav_data.js";
import type { NavNode } from "../../parts/nav.js";

import { COMPONENT_PAGES } from "./destinations.js";

/**
 * The Storybook stories scenario: the catalogue also holds the Menu stories
 * file, the configuration gives the URL of the published Storybook, and on
 * this branch Menu's Expanded story no longer renders. `stories` is its
 * Changes filter, which holds Expanded alone, and `stories-all` is the same
 * scenario under All.
 */
export type StoryScenario = "stories" | "stories-all";

/** The scenario's Changes count and the artboard that its Changes opens. */
export const STORY_CHANGES = {
  count: 1,
  to: COMPONENT_PAGES["story-failed-changes"],
} as const;

/**
 * Menu and its Expanded variant under All. Only Expanded changed, so the Menu
 * row carries the aggregate mark of its variant.
 */
function menuRows(): NavNode[] {
  const menu = COMPONENT_NAVIGATION.menu;
  return [
    {
      key: menu.id,
      changed: true,
      depth: 1,
      kind: "component",
      label: menu.title,
      to: COMPONENT_PAGES["storybook-link"],
      variants: "open",
    },
    ...componentVariantRows("menu", 2).map((row) => ({
      ...row,
      changed: true,
    })),
  ];
}

/**
 * The scenario under All: the whole catalogue with the Menu at the end of the
 * Components folder. Only the Menu's rows own an artboard in this scenario,
 * so every other row is a depiction.
 */
export function storyRowsInAll(rows: readonly NavNode[]): NavNode[] {
  return [
    ...rows.map(({ to: _to, ...row }) =>
      row.key === "components" ? { ...row, count: (row.count ?? 0) + 1 } : row,
    ),
    ...menuRows(),
  ];
}
