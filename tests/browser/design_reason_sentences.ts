/** Browser checks of the reason sentences of the design contract. */

import { expect, type Locator } from "@playwright/test";

import {
  REASON_SENTENCES,
  type SentenceReason,
} from "../helpers/reason_sentences.js";

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
