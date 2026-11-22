/**
 * The Search artboards: the tag picker and its filters of the Canvas viewer family. `../../parts/destinations.ts`
 * spreads them into `CANVAS_PAGES`, so Canvas links reach them.
 */
export const SEARCH_PAGES = {} as const;

export type SearchDestination =
  (typeof SEARCH_PAGES)[keyof typeof SEARCH_PAGES];
