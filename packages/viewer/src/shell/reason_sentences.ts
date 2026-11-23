/**
 * The sentence of each direct reason in the comparison details, from the
 * reason table of the
 * [comparison details design](../../../../docs/protocol/mokly-component-workspace-design.md#comparison-details).
 */

import type { EvidenceReason } from "@mokly/ui/comparison-evidence";

import type { ChangeReason } from "../review/types.js";

/**
 * Each reason's sentence from the component workspace design's table. A
 * `dependency` reads only through the changed files, and a `screen` reason,
 * which only a use case carries, reads as its changed steps.
 */
const REASON_SENTENCES = {
  added: "Added to this branch.",
  removed: "Removed on this branch.",
  material: "Rendered content changed.",
  implementation: "Rendered content changed where this component is used.",
  inputs: "Supplied props or slots changed.",
  structure: "Component instances changed.",
  metadata: "Page details or saved examples changed.",
} as const;

function reasonKey(reason: ChangeReason): string {
  return reason.kind === "dependency"
    ? `${reason.kind}/${reason.path}`
    : reason.kind === "screen"
      ? `${reason.kind}/${reason.screenPath}`
      : reason.kind;
}

/** The sentence of each reason that has one, keyed by the reason and its place. */
export function reasonSentences(
  reasons: readonly ChangeReason[],
): EvidenceReason[] {
  return reasons.flatMap((reason, index) =>
    reason.kind === "dependency" || reason.kind === "screen"
      ? []
      : [
          {
            key: `${reasonKey(reason)}/${index}`,
            text: REASON_SENTENCES[reason.kind],
          },
        ],
  );
}
