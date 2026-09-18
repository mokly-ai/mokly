/** Synthetic component usage shared by the design screens, never product data. */
export const toolbarPrompt = "Ready for your next step?";

export const componentUses = [
  {
    title: "Welcome",
    kind: "screen",
    count: 2,
    via: "Direct and via Toolbar",
    to: "design-component-inspection-details",
  },
  {
    title: "Details",
    kind: "screen",
    count: 1,
    via: "Direct",
    to: "design-component-inspection-consumer",
  },
  {
    title: "Toolbar",
    kind: "component",
    count: 1,
    via: "Default variant",
    to: "design-component-toolbar",
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
  {
    component: "Toolbar",
    label: "Main",
    id: "main",
    parent: null,
    visible: true,
  },
  {
    component: "Action",
    label: "Toolbar action",
    id: "toolbar-action",
    parent: "main",
    visible: true,
  },
  {
    component: "Action",
    label: "Footer action",
    id: "footer-action",
    parent: null,
    visible: true,
  },
  {
    component: "Help hint",
    label: "Help",
    id: "help",
    parent: null,
    visible: false,
  },
] as const;

export const componentDesignDocs = [
  "docs/protocol/mokly-component-design.md",
  "docs/protocol/mokly-component-explorer.md",
  "docs/protocol/mokly-component-inspector-design.md",
  "docs/protocol/mokly-component-controls-design.md",
  "docs/protocol/mokly-component-workspace-design.md",
];
