/**
 * The Comparison evidence artboards of the Canvas viewer family: the shipped
 * evidence of a comparison, such as the stylesheet files that changed, in the
 * Changes tab of a changed entry and in Inspect of an entry without Changes.
 * `../../parts/destinations.ts` spreads them into `CANVAS_PAGES`, so Canvas
 * links reach them. Each key starts with `evidence`, so no key of another
 * state kind replaces one.
 */
export const EVIDENCE_PAGES = {
  evidenceStyles: "design/canvas/evidence/styles",
  evidenceStylesUnresolved: "design/canvas/evidence/styles/unresolved",
  evidenceStylesUnnamed: "design/canvas/evidence/styles/unnamed",
  evidenceStylesExcluded: "design/canvas/evidence/styles/excluded",
  evidenceUnchanged: "design/canvas/evidence/unchanged",
  evidenceUnchangedAction: "design/canvas/evidence/unchanged/action",
  evidencePage: "design/canvas/evidence/page",
  evidencePageInspect: "design/canvas/evidence/page/inspect",
  evidenceIgnored: "design/canvas/evidence/ignored",
} as const;

export type EvidenceDestination =
  (typeof EVIDENCE_PAGES)[keyof typeof EVIDENCE_PAGES];
