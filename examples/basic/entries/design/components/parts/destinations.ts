import type { ControlsState } from "../controls/parts/fixtures.js";

import type { ComponentPageState } from "./component_details.js";
import type { ScreenPageState } from "./screen_preview.js";

/** Each component page selects its authored navigation state explicitly. */
export const COMPONENT_PAGES = {
  closed: "design-component-inspector-closed",
  default: "design-component-overview",
  disabled: "design-component-variants",
  comparison: "design-component-comparison",
  affected: "design-component-affected",
  toolbar: "design-component-toolbar",
  hidden: "design-component-help",
  unused: "design-component-unused",
  added: "design-component-added",
  removed: "design-component-removed",
  "usage-loading": "design-component-usage-loading",
  "usage-failed": "design-component-usage-failed",
} as const satisfies Record<ComponentPageState, string>;

/** Screen inspection states remain separate from the existing Browse subjects. */
export const INSPECTION_PAGES = {
  closed: "design-component-screen-inspector-closed",
  details: "design-component-inspection-details",
  highlight: "design-component-inspection-highlight",
  nested: "design-component-inspection-nested",
  "direct-change": "design-component-inspection-direct-change",
  consumer: "design-component-inspection-consumer",
  "toolbar-selection": "design-component-inspection-toolbar",
  "help-selection": "design-component-inspection-help",
  empty: "design-component-empty",
  unavailable: "design-component-unavailable",
  "inspection-loading": "design-component-inspection-loading",
  "removed-consumer": "design-component-removed-consumer",
} as const satisfies Record<ScreenPageState, string>;

export const CONTROLS_PAGES = {
  default: "design-component-controls",
  edited: "design-component-controls-edited",
  unset: "design-component-controls-unset",
  variant: "design-component-controls-variant",
  reset: "design-component-controls-reset",
  pending: "design-component-controls-pending",
  invalid: "design-component-controls-invalid",
  error: "design-component-controls-error",
  comparison: "design-component-controls-comparison",
  readonly: "design-component-controls-readonly",
  "readonly-variant": "design-component-controls-readonly-variant",
} as const satisfies Record<ControlsState, string>;

export type ComponentDesignDestination =
  | (typeof CONTROLS_PAGES)[keyof typeof CONTROLS_PAGES]
  | (typeof COMPONENT_PAGES)[keyof typeof COMPONENT_PAGES]
  | (typeof INSPECTION_PAGES)[keyof typeof INSPECTION_PAGES];
