/**
 * The Change outcomes artboards that this family adds beside the added entry: the moved and removed outcomes of the Canvas viewer family. `../../parts/destinations.ts`
 * spreads them into `CANVAS_PAGES`, so Canvas links reach them.
 */
export const OUTCOME_PAGES = {} as const;

export type OutcomeDestination =
  (typeof OUTCOME_PAGES)[keyof typeof OUTCOME_PAGES];
