/**
 * The Comparison evidence artboards of the Canvas viewer family: the shipped
 * evidence of a comparison, such as the stylesheet files that changed.
 * `../../parts/destinations.ts` spreads them into `CANVAS_PAGES`, so Canvas
 * links reach them.
 */
export const EVIDENCE_PAGES = {} as const;

export type EvidenceDestination =
  (typeof EVIDENCE_PAGES)[keyof typeof EVIDENCE_PAGES];
