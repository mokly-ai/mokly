/** Stable destinations for the Static and Live design gallery. */
export const INTERACTIVE_PAGES = {
  overview: "design-interactive-overview",
  static: "design-interactive-static",
  preparing: "design-interactive-preparing",
  unavailable: "design-interactive-unavailable",
  component: "design-interactive-component",
  staticCatalogue: "design-interactive-static-catalogue",
} as const;

export type InteractiveDesignDestination =
  (typeof INTERACTIVE_PAGES)[keyof typeof INTERACTIVE_PAGES];
