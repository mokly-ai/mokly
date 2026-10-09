import type { DefaultTreeAdapterMap } from "parse5";

import type { ComponentViewRecord } from "@mokly/viewer";

import { insertedStylesheetSpans } from "../components/stylesheet_spans.js";
import { MoklyError } from "../errors.js";
import { parseHtmlLinks } from "../html_links.js";

import { referenceRoutes } from "./asset_references.js";

/** Read only proven inserted links before Review-ignore or page-material removal. */
export function insertedStylesheetResources(
  html: string | undefined,
  usage: Pick<ComponentViewRecord, "insertedStylesheets"> | undefined,
  route: string,
  document?: DefaultTreeAdapterMap["document"],
): readonly string[] {
  if (html === undefined) return [];
  if (usage?.insertedStylesheets?.length === 0 || !usage) return [];
  const parsed = parseHtmlLinks(html, document);
  const links = new Map(
    parsed.links.map((link) => [link.location.startOffset, link]),
  );
  return insertedStylesheetSpans(html, usage, parsed.document).map((span) => {
    const paths = referenceRoutes(route, [
      links.get(span.startOffset)!.attributes.get("href")!,
    ]);
    if (paths.length !== 1 || paths[0] !== span.path)
      throw new MoklyError(
        "review-invalid",
        "inserted stylesheet span does not match its resource path",
      );
    return paths[0]!;
  });
}
