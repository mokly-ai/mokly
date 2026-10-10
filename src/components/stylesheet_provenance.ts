import type {
  ComponentViewRecord,
  InsertedComponentStylesheet,
} from "@mokly/viewer";
import { generatedResourcePath } from "@mokly/viewer/data";

import { parseHtmlLinks } from "../html_links.js";

import type { LinkedComponentStylesheet } from "./render.js";
import { publicFileFromHref } from "./stylesheet_reuse.js";

/** Locate only Mokly-inserted links after the source-preserving link edits. */
export function finalizeComponentStylesheets(
  html: string,
  view: ComponentViewRecord,
  route: string,
  mockupsDir: string,
  declarations: readonly LinkedComponentStylesheet[],
): { html: string; view: ComponentViewRecord } {
  const inserted = new Map(
    declarations.map((declaration) => [declaration.physical, declaration]),
  );
  const insertedStylesheets: InsertedComponentStylesheet[] = [];
  for (const link of parseHtmlLinks(html).links) {
    if (!link.stylesheet || !link.location) continue;
    const href = link.attributes.get("href");
    const file =
      href &&
      publicFileFromHref(href, generatedResourcePath(route), mockupsDir);
    const declaration = file && inserted.get(file.physicalPath);
    if (!file || !declaration) continue;
    insertedStylesheets.push({
      startOffset: link.location.startOffset,
      endOffset: link.location.endOffset,
      path: file.publicPath,
      componentPaths: declaration.componentPaths,
    });
  }
  insertedStylesheets.sort(
    (left, right) => left.startOffset - right.startOffset,
  );
  return { html, view: { ...view, insertedStylesheets } };
}
