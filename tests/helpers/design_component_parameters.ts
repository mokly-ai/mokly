/**
 * Custom properties that a `@mokly/ui` stylesheet reads with a fallback,
 * because the host or the component sets them at run time. The design
 * palettes need not declare them. Each entry names who sets the property.
 */
export const COMPONENT_PARAMETERS = new Map([
  ["--mbk-indent", "each catalogue row sets its own indent"],
  ["--mbk-nav-width", "a resizable catalogue column sets its own width"],
  [
    "--mbk-canvas-inset-top",
    "the Canvas layout's root sets the room of its compact entry bar",
  ],
  [
    "--mbk-canvas-inset-end",
    "the Canvas layout's root sets the room of its right panel",
  ],
  [
    "--mbk-canvas-inset-bottom",
    "the Canvas layout's root sets the room of its compact dock",
  ],
  [
    "--mbk-canvas-inset-start",
    "the Canvas layout's root sets the room of its catalogue",
  ],
  ["--inspector-height", "a resizable inspector sets its own height"],
  ["--inspector-tabs", "a static inspector sets the number of its tabs"],
  ["--inspector-tab", "each tab of a static inspector sets its own column"],
  [
    "--mbk-comparison-canvas",
    "a comparison's host paints the canvas colour of each version",
  ],
  [
    "--mokly-top-bar-inset-start",
    "a host insets the bar from its window buttons",
  ],
  [
    "--mokly-top-bar-inset-end",
    "a host insets the bar from its window buttons",
  ],
]);
