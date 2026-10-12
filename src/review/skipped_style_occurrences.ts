/** A skipped style can be substituted only when all its exact copies are substituted. */
import type { InlineStyleSpan } from "./css/inline_styles.js";

export function allSkippedOccurrencesEligible(
  source: string,
  spans: readonly InlineStyleSpan[],
): boolean {
  const starts = new Map<string, Set<number>>();
  for (const span of spans) {
    let positions = starts.get(span.source);
    if (!positions) starts.set(span.source, (positions = new Set()));
    positions.add(span.start);
  }
  for (const [text, positions] of starts)
    for (
      let offset = source.indexOf(text);
      offset !== -1;
      offset = source.indexOf(text, offset + 1)
    )
      if (!positions.has(offset)) return false;
  return true;
}
