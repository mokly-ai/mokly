/**
 * The component explorer artboards that stay while decision 34 is open: a
 * removed saved variant, and the removed screen that consumed it.
 */
export const COMPONENT_PAGES = {
  removed: "design/components/states/removed",
} as const;

export const INSPECTION_PAGES = {
  "removed-consumer": "design/components/states/removed-consumer",
} as const;

export type ComponentDesignDestination =
  | (typeof COMPONENT_PAGES)[keyof typeof COMPONENT_PAGES]
  | (typeof INSPECTION_PAGES)[keyof typeof INSPECTION_PAGES];
