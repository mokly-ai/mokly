/**
 * The Search artboards: the tag picker and its filters of the Canvas viewer family. `../../parts/destinations.ts`
 * spreads them into `CANVAS_PAGES`, so Canvas links reach them.
 */
export const SEARCH_PAGES = {
  tagPicker: "design/canvas/search/tags",
  tagForms: "design/canvas/search/tags/forms",
  tagFormsPicker: "design/canvas/search/tags/forms-picker",
  tagOnboarding: "design/canvas/search/tags/onboarding",
  tagOnboardingPicker: "design/canvas/search/tags/onboarding-picker",
} as const;

export type SearchDestination =
  (typeof SEARCH_PAGES)[keyof typeof SEARCH_PAGES];
