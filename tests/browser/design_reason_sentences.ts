/** The reason sentences of the component workspace design contract. */

import { expect, type Locator } from "@playwright/test";

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

/** The evidence reads each given reason once, and no other reason at all. */
export async function expectReasonSentences(
  evidence: Locator,
  reasons: readonly SentenceReason[],
  label: string,
): Promise<void> {
  for (const [kind, sentence] of Object.entries(REASON_SENTENCES))
    await expect(
      evidence.getByText(sentence, { exact: true }),
      `${label}: ${kind}`,
    ).toHaveCount(reasons.includes(kind as SentenceReason) ? 1 : 0);
}
