import type {
  ComponentViewRecord,
  InsertedComponentStylesheet,
} from "@mokly/viewer";

import { MoklyError } from "../errors.js";
import { parseHtmlLinks } from "../html_links.js";

/** Validate provenance against active full links in the original final document. */
export function insertedStylesheetSpans(
  html: string,
  usage: Pick<ComponentViewRecord, "insertedStylesheets"> | undefined,
): readonly InsertedComponentStylesheet[] {
  if (!usage) return [];
  const spans = usage.insertedStylesheets;
  if (!Array.isArray(spans))
    throw new MoklyError(
      "review-invalid",
      "component usage is missing inserted stylesheet provenance",
    );
  if (!spans.length) return spans;
  const links = new Map(
    parseHtmlLinks(html).links.map((link) => [link.location.startOffset, link]),
  );
  let previousEnd = 0;
  for (const span of spans) {
    const link = links.get(span.startOffset);
    if (
      span.startOffset < previousEnd ||
      !link?.stylesheet ||
      !link.attributes.get("href") ||
      link.location.endOffset !== span.endOffset
    )
      throw new MoklyError(
        "review-invalid",
        "invalid inserted stylesheet span",
      );
    previousEnd = span.endOffset;
  }
  return spans;
}
