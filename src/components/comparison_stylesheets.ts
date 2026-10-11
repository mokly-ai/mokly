import type { ComponentViewRecord } from "@mokly/viewer";

import { TextOffsetMap } from "../text_patches.js";

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
    (span) =>
      !rootComponentId || !span.componentPaths.includes(rootComponentId),
  );
  if (!removed.length) return { html, usage };
  const edits = new TextOffsetMap(html);
  const material = edits.apply(
    removed.map((span) => ({
      start: span.startOffset,
      end: span.endOffset,
      text: "",
    })),
  );
  return {
    html: material,
    usage: {
      ...usage,
      styles: rebaseStyleOwnership(edits, usage.styles),
    },
  };
}
