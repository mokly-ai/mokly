/** Stable destinations for the Static and Live design gallery. */
export const INTERACTIVE_PAGES = {
  overview: "design/interactive/overview",
  static: "design/interactive/modes/static",
  preparing: "design/interactive/modes/preparing",
  unavailable: "design/interactive/modes/unavailable",
  component: "design/interactive/workspace/component",
  screen: "design/interactive/workspace/screen",
  staticCatalogue: "design/interactive/workspace/static-catalogue",
} as const;

export type InteractiveDesignDestination =
  (typeof INTERACTIVE_PAGES)[keyof typeof INTERACTIVE_PAGES];
