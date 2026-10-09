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
 * Changes stories caused only by one changed `.action` rule. In `styles` it
 * styles only Action's output; in `styles-outside` it also styles a link on
 * Welcome that is not part of Action.
 */
export type StyleScenario = "styles" | "styles-outside";

/** Each story's Changes count and the artboard its Changes shortcut opens. */
export const STYLE_CHANGES = {
  styles: { count: 4, to: COMPONENT_PAGES["style-changed"] },
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

/** Changes rows: Action alone, or Welcome too when it matched outside Action. */
export function styleScenarioRows(scenario: StyleScenario): NavNode[] {
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
