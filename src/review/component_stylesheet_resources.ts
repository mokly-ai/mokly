import type { ComponentViewRecord } from "@mokly/viewer";

import { insertedStylesheetSpans } from "../components/stylesheet_spans.js";
import { MoklyError } from "../errors.js";

import { referencedRoutes } from "./asset_references.js";

/** Read only proven inserted links before Review-ignore or page-material removal. */
export function insertedStylesheetResources(
  html: string | undefined,
  usage: Pick<ComponentViewRecord, "insertedStylesheets"> | undefined,
  route: string,
): readonly string[] {
  if (html === undefined) return [];
  return insertedStylesheetSpans(html, usage).map((span) => {
    const paths = referencedRoutes(
      route,
      html.slice(span.startOffset, span.endOffset),
      { resourceHints: false },
    );
    if (paths.length !== 1 || paths[0] !== span.path)
      throw new MoklyError(
        "review-invalid",
        "inserted stylesheet span does not match its resource path",
      );
    return paths[0]!;
  });
}
