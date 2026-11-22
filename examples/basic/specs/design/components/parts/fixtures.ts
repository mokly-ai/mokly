import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";

/** Synthetic component usage shared by the design screens, never product data. */
export const toolbarPrompt = "Ready for your next step?";

/**
 * The Action that the depicted Toolbar renders, as the Toolbar page names it
 * in its nested components and on its highlight region.
 */
export const toolbarAction = "Action · Main action";

/**
 * The consumers of the depicted Action. Each opens its Canvas artboard: a
 * screen with its instance of the Action selected, and the Toolbar's set.
 */
export const componentUses = [
  {
    title: "Welcome",
    kind: "screen",
    count: 2,
    via: "Direct and via Toolbar",
    to: CANVAS_PAGES.selection,
  },
  {
    title: "Details",
    kind: "screen",
    count: 1,
    via: "Direct",
    to: CANVAS_PAGES.addedWelcome,
  },
  {
    title: "Toolbar",
    kind: "component",
    count: 1,
    via: "Default variant",
    to: CANVAS_PAGES.componentSetToolbar,
  },
] as const;

/** Recorded contexts represented by each usage row in this mockup scenario. */
export const usageViews = [
  "Mobile · Light",
  "Mobile · Dark",
  "Desktop · Light",
  "Desktop · Dark",
] as const;

/** Logical instances in the depicted Welcome view, including a null render. */
export const welcomeInstances = [
  { component: "Toolbar", label: "Main", id: "main", parent: null },
  {
    component: "Action",
    label: "Toolbar action",
    id: "toolbar-action",
    parent: "main",
  },
  {
    component: "Action",
    label: "Footer action",
    id: "footer-action",
    parent: null,
  },
  { component: "Help hint", label: "Help", id: "help", parent: null },
] as const;

export const componentDesignDocs = [
  "docs/protocol/mokly-component-design.md",
  "docs/protocol/mokly-component-explorer.md",
  "docs/protocol/mokly-component-inspector-design.md",
  "docs/protocol/mokly-component-controls-design.md",
  "docs/protocol/mokly-component-workspace-design.md",
];
