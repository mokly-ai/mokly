/**
 * The Change outcomes artboards that this family adds beside the added entry:
 * the moved outcome, and a removed entry's previous version. The removed
 * screen keeps its states as saved variants: its Inspect tab, a long screen,
 * the previous version loading and unavailable, and a viewport without a
 * previous view. The removed document keeps a long page, the loading and
 * unavailable states, and a light-only document. The removed screen variant
 * keeps its Inspect tab. `../../parts/destinations.ts` spreads them into
 * `CANVAS_PAGES`, so Canvas links reach them.
 */
export const OUTCOME_PAGES = {
  moved: "design/canvas/outcomes/moved",
  movedInspect: "design/canvas/outcomes/moved/inspect",
  removed: "design/canvas/outcomes/removed",
  removedInspect: "design/canvas/outcomes/removed/inspect",
  removedLong: "design/canvas/outcomes/removed/long",
  removedLoading: "design/canvas/outcomes/removed/loading",
  removedUnavailable: "design/canvas/outcomes/removed/unavailable",
  removedNoView: "design/canvas/outcomes/removed/no-view",
  removedDocument: "design/canvas/outcomes/removed-document",
  removedDocumentLong: "design/canvas/outcomes/removed-document/long",
  removedDocumentLoading: "design/canvas/outcomes/removed-document/loading",
  removedDocumentUnavailable:
    "design/canvas/outcomes/removed-document/unavailable",
  removedDocumentLightOnly:
    "design/canvas/outcomes/removed-document/light-only",
  removedVariant: "design/canvas/outcomes/removed-variant",
  removedVariantInspect: "design/canvas/outcomes/removed-variant/inspect",
} as const;

export type OutcomeDestination =
  (typeof OUTCOME_PAGES)[keyof typeof OUTCOME_PAGES];
