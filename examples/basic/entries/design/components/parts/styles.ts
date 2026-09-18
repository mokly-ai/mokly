/** Shared styles and dependency identities for every component design collection. */
export const designBaseStyles = [
  "design.css",
  "design-stage.css",
  "design-review.css",
];
export const workspaceLayoutStyles = [
  "design-component-inspector.css",
  "design-component-workspace.css",
];
export const componentLayoutStyles = [
  "design-components.css",
  "design-component-inspection.css",
  "design-component-details.css",
  ...workspaceLayoutStyles,
  "design-component-view.css",
];

export const componentStyles = [...designBaseStyles, ...componentLayoutStyles];
export const componentPanelVariantStyles = [
  "design-component-panel-index.css",
  "design-component-panel-tree.css",
  "design-component-panel-variants.css",
];

export const componentStyleDependencies = componentStyles.map(
  (stylesheet) => `examples/basic/generated/${stylesheet}`,
);
export const componentPanelVariantStyleDependencies =
  componentPanelVariantStyles.map(
    (stylesheet) => `examples/basic/generated/${stylesheet}`,
  );
