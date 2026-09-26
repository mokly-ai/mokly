import type { ComponentViewRecord } from "@mokly/viewer";

import { MoklyError } from "../errors.js";

import { rebaseStyleOwnership } from "./style_ownership.js";

/** Remove only proven Mokly-inserted links from one page's comparison copy. */
export function comparisonStylesheetMaterial(
  html: string,
  usage: ComponentViewRecord | undefined,
  rootComponentId?: string,
): { html: string; usage: ComponentViewRecord | undefined } {
  const spans = usage?.insertedStylesheets ?? [];
  if (!spans.length) return { html, usage };
  let previousEnd = 0;
  for (const span of spans) {
    if (
      span.startOffset < previousEnd ||
      span.endOffset > html.length ||
      !/^<link\b/i.test(html.slice(span.startOffset, span.endOffset))
    )
      throw new MoklyError(
        "review-invalid",
        "invalid inserted stylesheet span",
      );
    previousEnd = span.endOffset;
  }
  const removed = spans.filter(
    (span) => !rootComponentId || !span.componentIds.includes(rootComponentId),
  );
  if (!removed.length) return { html, usage };
  let material = html;
  for (const span of [...removed].reverse())
    material =
      material.slice(0, span.startOffset) + material.slice(span.endOffset);
  return {
    html: material,
    usage: usage
      ? {
          ...usage,
          styles: rebaseStyleOwnership(html, material, usage.styles),
        }
      : undefined,
  };
}
