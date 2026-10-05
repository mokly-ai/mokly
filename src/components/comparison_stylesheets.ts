import type { ComponentViewRecord } from "@mokly/viewer";

import { rebaseStyleOwnership } from "./style_ownership.js";
import { insertedStylesheetSpans } from "./stylesheet_spans.js";

/** Remove only proven Mokly-inserted links from one page's comparison copy. */
export function comparisonStylesheetMaterial(
  html: string,
  usage: ComponentViewRecord | undefined,
  rootComponentId?: string,
): { html: string; usage: ComponentViewRecord | undefined } {
  if (!usage) return { html, usage };
  const spans = insertedStylesheetSpans(html, usage);
  if (!spans.length) return { html, usage };
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
    usage: {
      ...usage,
      styles: rebaseStyleOwnership(html, material, usage.styles),
    },
  };
}
