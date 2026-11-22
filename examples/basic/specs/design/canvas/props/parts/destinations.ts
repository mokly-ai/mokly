/**
 * The Props and controls artboards of the Canvas viewer family. `../../parts/destinations.ts`
 * spreads them into `CANVAS_PAGES`, so Canvas links reach them.
 */
export const PROPS_PAGES = {} as const;

export type PropsDestination = (typeof PROPS_PAGES)[keyof typeof PROPS_PAGES];
