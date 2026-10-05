/** Share exact original-source proofs within one view; never retain them across views. */
import { documentWorkSync } from "../diagnostics/timings.js";

import type { InlineStyleSpan } from "./css/inline_styles.js";
import { MaterialMarkerOffsets } from "./material_marker_offsets.js";
import { allSkippedOccurrencesEligible } from "./skipped_style_occurrences.js";
import { StyleSeamOffsets } from "./style_seam_offsets.js";

type Side = "before" | "after";
type OccurrenceInput = Pick<InlineStyleSpan, "source" | "start" | "end">;

interface SourceProofs {
  source: string;
  markers?: MaterialMarkerOffsets;
  styles: { inputs: readonly string[]; index: StyleSeamOffsets }[];
  occurrences: { inputs: readonly OccurrenceInput[]; eligible: boolean }[];
}

export class FingerprintSourceProofs {
  private readonly before: SourceProofs;
  private readonly after: SourceProofs;

  constructor(base: string, head: string) {
    this.before = { source: base, styles: [], occurrences: [] };
    this.after =
      base === head
        ? this.before
        : { source: head, styles: [], occurrences: [] };
  }

  markerOffsets(side: Side): MaterialMarkerOffsets {
    const proof = this[side];
    return (proof.markers ??= documentWorkSync(
      "normalizationMs",
      () => new MaterialMarkerOffsets(proof.source),
    ));
  }

  styleOffsets(
    side: Side,
    spans: readonly InlineStyleSpan[],
  ): StyleSeamOffsets {
    const proof = this[side];
    const previous = proof.styles.find(
      ({ inputs }) =>
        inputs.length === spans.length &&
        inputs.every((source, index) => source === spans[index]!.source),
    );
    if (previous) return previous.index;
    const inputs = spans.map(({ source }) => source);
    const index = new StyleSeamOffsets(proof.source, inputs);
    proof.styles.push({ inputs, index });
    return index;
  }

  occurrencesEligible(side: Side, spans: readonly InlineStyleSpan[]): boolean {
    const proof = this[side];
    const previous = proof.occurrences.find(
      ({ inputs }) =>
        inputs.length === spans.length &&
        inputs.every((span, index) => {
          const other = spans[index]!;
          return (
            span.source === other.source &&
            span.start === other.start &&
            span.end === other.end
          );
        }),
    );
    if (previous) return previous.eligible;
    const eligible = allSkippedOccurrencesEligible(proof.source, spans);
    proof.occurrences.push({
      inputs: spans.map(({ source, start, end }) => ({ source, start, end })),
      eligible,
    });
    return eligible;
  }
}
