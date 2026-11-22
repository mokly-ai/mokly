/**
 * The Loading and recovery artboards of the Canvas viewer family. `../../parts/destinations.ts`
 * spreads them into `CANVAS_PAGES`, so Canvas links reach them.
 */
export const LOADING_PAGES = {} as const;

export type LoadingDestination =
  (typeof LOADING_PAGES)[keyof typeof LOADING_PAGES];
