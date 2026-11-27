/** The reason sentences of the component workspace design contract. */

/** Each direct reason's one sentence in Details. */
export const REASON_SENTENCES = {
  added: "Added to this branch.",
  removed: "Removed on this branch.",
  material: "Rendered content changed.",
  implementation: "Rendered content changed where this component is used.",
  inputs: "Supplied props or slots changed.",
  structure: "Component instances changed.",
  metadata: "Page details or saved examples changed.",
} as const;

/** A reason kind with a sentence; a `dependency` reads through its files. */
export type SentenceReason = keyof typeof REASON_SENTENCES;
