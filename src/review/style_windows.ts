/** Prove one raw-text edit using only head spans and original UTF-16 code units. */
import type { SourceSpan } from "../components/material_recipe.js";

import type { InlineStyleSpan } from "./css/inline_styles.js";
import { reviewIgnoreRegions, reviewMaterialSpans } from "./ignore.js";
import type { PageAnalysisPair } from "./page_pair.js";
import {
  pairedIgnoreTouchesStyles,
  styleTagsContainReviewMarker,
} from "./style_source_safety.js";

export interface StyleWindows {
  before: SourceSpan;
  after: SourceSpan;
}

/** Condition 2: longest prefix, followed by the non-overlapping longest suffix. */
export function changedStyleWindows(
  base: string,
  head: string,
): StyleWindows | undefined {
  if (base === head) return;
  let start = 0;
  const limit = Math.min(base.length, head.length);
  while (start < limit && base.charCodeAt(start) === head.charCodeAt(start))
    start++;
  let baseEnd = base.length;
  let headEnd = head.length;
  while (
    baseEnd > start &&
    headEnd > start &&
    base.charCodeAt(baseEnd - 1) === head.charCodeAt(headEnd - 1)
  ) {
    baseEnd--;
    headEnd--;
  }
  return { before: { start, end: baseEnd }, after: { start, end: headEnd } };
}

/** Condition 3: the same eligible element, unchanged tags, and safe marker spans. */
export function styleWindowSpans(
  pages: PageAnalysisPair,
  windows: StyleWindows,
):
  | {
      before: readonly InlineStyleSpan[];
      after: readonly InlineStyleSpan[];
    }
  | undefined {
  const paired = pages.pairedIgnoreIds;
  const head = pages.afterAnalysis;
  const after = head.inlineStyles(paired);
  const ignored = head.ignored(paired);
  if (
    pairedIgnoreTouchesStyles(after, ignored) ||
    after.some(styleTagsContainReviewMarker)
  )
    return;
  const edited = after.find(
    (span) =>
      span.contentStart !== undefined &&
      span.contentEnd !== undefined &&
      span.contentStart <= windows.after.start &&
      windows.after.end <= span.contentEnd,
  );
  if (!edited) return;
  const delta = windows.before.end - windows.after.end;
  const contentStart = edited.contentStart!;
  const contentEnd = edited.contentEnd! + delta;
  const baseRegions = reviewIgnoreRegions(
    pages.baseText,
    pages.before.path,
  ).filter(({ id }) => paired.includes(id));
  for (const [window, spans] of [
    [windows.before, reviewMaterialSpans(pages.baseText)],
    [windows.after, reviewMaterialSpans(pages.headText)],
  ] as const)
    if (spans.some((span) => intersects(window, span))) return;
  const before = after.map((span) => {
    if (span.end <= edited.start) return span;
    if (span === edited)
      return {
        ...span,
        end: span.end + delta,
        contentEnd,
        source: pages.baseText.slice(span.start, span.end + delta),
        text: pages.baseText.slice(contentStart, contentEnd),
      };
    return {
      ...span,
      start: span.start + delta,
      end: span.end + delta,
      ...(span.contentStart === undefined
        ? {}
        : { contentStart: span.contentStart + delta }),
      ...(span.contentEnd === undefined
        ? {}
        : { contentEnd: span.contentEnd + delta }),
    };
  });
  if (
    pairedIgnoreTouchesStyles(before, baseRegions) ||
    before.some(styleTagsContainReviewMarker)
  )
    return;
  return { before, after };
}

/** Condition 4 includes empty windows and the code unit exactly eight places before. */
export function rawTextWindowSafe(source: string, window: SourceSpan): boolean {
  return !source.slice(Math.max(0, window.start - 8), window.end).includes("<");
}

function intersects(window: SourceSpan, span: SourceSpan): boolean {
  return window.start === window.end
    ? span.start < window.start && window.start < span.end
    : window.start < span.end && span.start < window.end;
}
