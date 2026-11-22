/**
 * The Use case artboards of the Canvas viewer family: a use case as one
 * section of step frames. `../../parts/destinations.ts` spreads them into
 * `CANVAS_PAGES`, so Canvas links reach them.
 */
export const FLOW_PAGES = {} as const;

export type FlowDestination = (typeof FLOW_PAGES)[keyof typeof FLOW_PAGES];
