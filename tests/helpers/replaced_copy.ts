/** One sentence a protocol replaced, and what the design catalogue says now. */
export interface ReplacedCopy {
  /** Visible text no design entry may render again. */
  text: string;
  /** Contract that replaced it, named when a design entry drifts back. */
  contract: string;
  /** The behavior that took its place. */
  instead: string;
}

const removedPreviews = "docs/protocol/mokly-removed-previews.md";

/**
 * Copy the protocols retired. Mockup families outside a feature's named scope
 * keep rendering replaced sentences long after the contract changed, so every
 * generated design document is checked against this list. Add an entry here
 * whenever a protocol replaces visible shell copy, so one list keeps the whole
 * catalogue aligned instead of each family being audited by hand.
 */
export const REPLACED_DESIGN_COPY: readonly ReplacedCopy[] = [
  {
    text: "This screen was removed",
    contract: removedPreviews,
    instead: "a removed screen opens its previous version",
  },
  {
    text: "This page was removed",
    contract: removedPreviews,
    instead: "a removed page opens its previous version",
  },
  {
    text: "There is no current preview to show.",
    contract: removedPreviews,
    instead: "the stage carries the previous version",
  },
  {
    text: "Select a comparison to see the previous screen.",
    contract: removedPreviews,
    instead: "the previous version opens with the entry, without a comparison",
  },
  {
    text: "This document is no longer in the catalogue.",
    contract: removedPreviews,
    instead: "the removed document's own previous version is shown",
  },
];

/** Compare rendered text without depending on generated line breaks. */
export function normalizeCopy(text: string): string {
  return text.replace(/\s+/gu, " ");
}
