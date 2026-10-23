import {
  COMPONENT_NAVIGATION,
  componentVariantRows,
} from "../../parts/component_nav_data.js";
import type { NavNode } from "../../parts/nav.js";

import {
  COMPONENT_PAGES,
  INSPECTION_PAGES,
  type ComponentDesignDestination,
} from "./destinations.js";

/**
 * Stories of one changed `.action` rule. In `styles` it styles only Action's
 * output, beside a markup change that shows only where screens use Action and
 * so adds no row; `styles-all` is the same story under All, where a screen
 * that Action affects opens; in `styles-outside` it also styles a link on
 * Welcome that is not part of Action.
 */
export type StyleScenario = "styles" | "styles-all" | "styles-outside";

/** Each story's Changes count and the artboard its Changes shortcut opens. */
export const STYLE_CHANGES = {
  styles: { count: 4, to: COMPONENT_PAGES["style-changed"] },
  "styles-all": { count: 4, to: COMPONENT_PAGES["style-changed"] },
  "styles-outside": { count: 5, to: INSPECTION_PAGES["style-outside"] },
} as const satisfies Record<
  StyleScenario,
  { count: number; to: ComponentDesignDestination }
>;

/** Whether a Changes story is one of the stylesheet stories above. */
export function isStyleScenario(scenario: string): scenario is StyleScenario {
  return Object.hasOwn(STYLE_CHANGES, scenario);
}

/**
 * The rule matches Action's own output on the parent and on every saved
 * variant, so each has its own row. The variants own no artboard in these
 * stories, so their rows stay depictions.
 */
function actionRows(): NavNode[] {
  return [
    {
      key: "components",
      depth: 0,
      kind: "folder",
      label: "Components",
      open: true,
    },
    {
      key: COMPONENT_NAVIGATION.action.id,
      changed: true,
      depth: 1,
      kind: "component",
      label: COMPONENT_NAVIGATION.action.title,
      to: COMPONENT_PAGES["style-changed"],
      variants: "open",
    },
    ...componentVariantRows("action", 2).map(({ to: _to, ...row }) => ({
      ...row,
      changed: true,
    })),
  ];
}

/**
 * The `styles` story under All: the whole catalogue, with Action and its saved
 * variants marked as changed. In this story only Action and the shown screen
 * own an artboard, so every other row is a depiction.
 */
export function styleStoryRowsInAll(
  rows: readonly NavNode[],
  design: ComponentDesignDestination,
): NavNode[] {
  const action = COMPONENT_NAVIGATION.action;
  const variants = new Set<string>(action.variants.map(({ id }) => id));
  return rows.map(({ to, ...row }) =>
    row.key === action.id
      ? { ...row, changed: true, to: COMPONENT_PAGES["style-changed"] }
      : variants.has(row.key)
        ? { ...row, changed: true }
        : to === design
          ? { ...row, to }
          : row,
  );
}

/** Changes rows: Action alone, or Welcome too when it matched outside Action. */
export function styleScenarioRows(
  scenario: Exclude<StyleScenario, "styles-all">,
): NavNode[] {
  if (scenario === "styles") return actionRows();
  return [
    { key: "screens", depth: 0, kind: "folder", label: "Screens", open: true },
    {
      key: "selected-screen",
      changed: true,
      depth: 1,
      kind: "screen",
      label: "Welcome",
      to: INSPECTION_PAGES["style-outside"],
    },
    ...actionRows(),
  ];
}
