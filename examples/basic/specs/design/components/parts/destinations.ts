import type { ControlsState } from "../controls/parts/fixtures.js";

import type { ComponentPageState } from "./component_details.js";
import type { ScreenPageState } from "./screen_preview.js";

/** Each component page selects its authored navigation state explicitly. */
export const COMPONENT_PAGES = {
  "style-changed": "design/components/states/shared-impact/style-changed",
  closed: "design/components/inspector/inspector-closed",
  default: "design/components/overview",
  disabled: "design/components/pages/variants",
  comparison: "design/components/pages/comparison",
  overlay: "design/components/pages/stacked/overlay",
  difference: "design/components/pages/stacked/difference",
  "overlay-tall": "design/components/pages/stacked/overlay-tall",
  affected: "design/components/pages/affected",
  toolbar: "design/components/pages/toolbar",
  hidden: "design/components/pages/help",
  unused: "design/components/states/unused",
  added: "design/components/states/additions/added",
  removed: "design/components/states/removed",
  "usage-loading": "design/components/states/loading/usage-loading",
  "usage-failed": "design/components/states/loading/usage-failed",
  "props-loading": "design/components/states/loading/props-loading",
  "props-failed": "design/components/states/loading/props-failed",
  "shared-impact": "design/components/states/shared-impact/shared-impact",
} as const satisfies Record<ComponentPageState, string>;

/** Screen inspection states remain separate from the existing Browse subjects. */
export const INSPECTION_PAGES = {
  "style-outside": "design/components/states/shared-impact/style-outside",
  "affected-screen": "design/components/states/shared-impact/affected-screen",
  closed: "design/components/inspector/screen-inspector-closed",
  details: "design/components/inspection/inspection-details",
  highlight: "design/components/inspection/inspection-highlight",
  nested: "design/components/inspection/inspection-nested",
  "direct-change": "design/components/inspection/inspection-direct-change",
  consumer: "design/components/inspection/inspection-consumer",
  "toolbar-selection":
    "design/components/inspection/selection/inspection-toolbar",
  "help-selection": "design/components/inspection/selection/inspection-help",
  empty: "design/components/states/empty",
  unavailable: "design/components/states/unavailable",
  "inspection-loading": "design/components/states/loading/inspection-loading",
  "removed-consumer": "design/components/states/removed-consumer",
  "screen-props": "design/components/controls/editing/screen",
} as const satisfies Record<ScreenPageState, string>;

export const CONTROLS_PAGES = {
  parent: "design/components/controls/controls",
  default: "design/components/controls/controls/default",
  edited: "design/components/controls/editing/edited",
  unset: "design/components/controls/editing/unset",
  variant: "design/components/controls/editing/variant",
  reset: "design/components/controls/editing/reset",
  pending: "design/components/controls/states/pending",
  preparing: "design/components/controls/states/preparing",
  "preparing-failed": "design/components/controls/states/preparing/failed",
  invalid: "design/components/controls/states/invalid",
  error: "design/components/controls/states/error",
  comparison: "design/components/controls/states/comparison",
  readonly: "design/components/controls/published/readonly",
  "readonly-variant": "design/components/controls/published/readonly-variant",
  "invalid-together": "design/components/controls/limits/invalid-together",
  expired: "design/components/controls/limits/expired",
} as const satisfies Record<ControlsState, string>;

/** Props-tab limits drawn on existing component and screen pages. */
export const LIMIT_PAGES = {
  removed: "design/components/controls/limits/removed",
  "read-only": "design/components/controls/limits/read-only",
  "no-props": "design/components/controls/limits/no-props",
} as const;

export type ComponentDesignDestination =
  | (typeof CONTROLS_PAGES)[keyof typeof CONTROLS_PAGES]
  | (typeof LIMIT_PAGES)[keyof typeof LIMIT_PAGES]
  | (typeof COMPONENT_PAGES)[keyof typeof COMPONENT_PAGES]
  | (typeof INSPECTION_PAGES)[keyof typeof INSPECTION_PAGES];
