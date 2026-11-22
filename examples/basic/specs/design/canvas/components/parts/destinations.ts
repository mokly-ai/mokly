/**
 * The Component explorer artboards of the Canvas viewer family. `../../parts/destinations.ts`
 * spreads them into `CANVAS_PAGES`, so Canvas links reach them.
 */
export const EXPLORER_PAGES = {} as const;

export type ExplorerDestination =
  (typeof EXPLORER_PAGES)[keyof typeof EXPLORER_PAGES];
