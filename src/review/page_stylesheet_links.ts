/** Inserted-link proofs in original coordinates, without another HTML parse. */
import type { ComponentViewRecord } from "@mokly/viewer";

import { insertedStylesheetResources } from "./component_stylesheet_resources.js";
import type { PageAnalysisPair } from "./page_pair.js";
import type { StyleWindows } from "./style_windows.js";

/** Only prefilter equality here; original-tree validation precedes admission. */
export function insertedComparisonSource(
  source: string,
  usage: ComponentViewRecord | undefined,
  root?: string,
): string {
  if (!Array.isArray(usage?.insertedStylesheets)) return source;
  for (const span of [...usage.insertedStylesheets].reverse())
    if (!root || !span.componentPaths.includes(root))
      source = source.slice(0, span.startOffset) + source.slice(span.endOffset);
  return source;
}

/** Equal text can validate both provenance arrays against the head's one tree. */
export function identicalInsertedResources(
  pages: PageAnalysisPair,
): readonly string[] {
  const head = pages.afterAnalysis;
  const after = head.stylesheetResources;
  if (pages.baseText === pages.headText)
    insertedStylesheetResources(
      pages.baseText,
      pages.before.usage,
      pages.before.path,
      head.document,
    );
  return after;
}

/** A style edit shifts later spans but cannot alter a proven full link. */
export function insertedLinksFollowStyleWindow(
  pages: PageAnalysisPair,
  windows: StyleWindows,
): boolean {
  const before = pages.before.usage?.insertedStylesheets;
  const after = pages.after.usage?.insertedStylesheets;
  if (
    !Array.isArray(before) ||
    !Array.isArray(after) ||
    before.length !== after.length
  )
    return false;
  const delta = windows.after.end - windows.before.end;
  return before.every((span, i) => {
    const current = after[i]!;
    const shift =
      span.endOffset <= windows.before.start
        ? 0
        : span.startOffset >= windows.before.end
          ? delta
          : undefined;
    return (
      shift !== undefined &&
      span.startOffset + shift === current.startOffset &&
      span.endOffset + shift === current.endOffset &&
      pages.baseText.slice(span.startOffset, span.endOffset) ===
        pages.headText.slice(current.startOffset, current.endOffset)
    );
  });
}
