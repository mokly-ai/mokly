import type { DefaultTreeAdapterMap } from "parse5";

import type {
  ComponentViewRecord,
  InsertedComponentStylesheet,
} from "@mokly/viewer";

import { MoklyError } from "../errors.js";
import { parseHtmlLinks, stylesheetLink } from "../html_links.js";

import type { LinkedComponentStylesheet } from "./render.js";
import { publicFileFromHref } from "./stylesheet_reuse.js";

type Node = DefaultTreeAdapterMap["node"];
type Location = NonNullable<
  DefaultTreeAdapterMap["element"]["sourceCodeLocation"]
>;
const ATTRIBUTE = "data-mokly-component-stylesheet";

interface LinkedFile {
  active: boolean;
  physical: string;
  publicPath: string;
  location: Location;
  token: string;
  attribute: { startOffset: number; endOffset: number };
}

function markedLinks(
  html: string,
  route: string,
  mockupsDir: string,
): LinkedFile[] {
  const found: LinkedFile[] = [];
  const { document, links } = parseHtmlLinks(html);
  const active = new Set(links.map((link) => link.element));
  function visit(node: Node): void {
    if ("attrs" in node) {
      const token = node.attrs.find(
        (attribute) => attribute.name === ATTRIBUTE,
      );
      if (token && !stylesheetLink(node))
        throw new MoklyError(
          "build-invalid",
          `${route}: invalid ${ATTRIBUTE} owner`,
        );
      if (token && stylesheetLink(node)) {
        const href = node.attrs.find(
          (attribute) => attribute.name === "href",
        )?.value;
        const file = href && publicFileFromHref(href, route, mockupsDir);
        if (!file || !node.sourceCodeLocation?.attrs?.[ATTRIBUTE])
          throw new MoklyError(
            "build-invalid",
            `${route}: invalid ${ATTRIBUTE} link`,
          );
        found.push({
          active: active.has(node),
          physical: file.physicalPath,
          publicPath: file.publicPath,
          location: node.sourceCodeLocation,
          token: token.value,
          attribute: node.sourceCodeLocation.attrs[ATTRIBUTE]!,
        });
      }
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
    if ("content" in node) visit(node.content);
  }
  visit(document);
  return found;
}

/** Strip transient link tokens using the issued declaration data, without CSS ownership. */
export function finalizeComponentStylesheets(
  before: string,
  final: string,
  view: ComponentViewRecord,
  route: string,
  mockupsDir: string,
  declarations: readonly LinkedComponentStylesheet[],
): { html: string; view: ComponentViewRecord } {
  const issued = new Map(
    markedLinks(before, route, mockupsDir).map((link) => [
      link.token,
      link.physical,
    ]),
  );
  const marked = markedLinks(final, route, mockupsDir);
  const seen = new Set<string>();
  for (const link of marked) {
    if (
      !/^(0|[1-9][0-9]*)$/.test(link.token) ||
      seen.has(link.token) ||
      issued.get(link.token) !== link.physical
    )
      throw new MoklyError(
        "build-invalid",
        `${route}: ambiguous ${ATTRIBUTE} token`,
      );
    seen.add(link.token);
  }
  const removals = marked.map((link) => {
    const attribute = link.attribute;
    return {
      start:
        final[attribute.startOffset - 1] === " "
          ? attribute.startOffset - 1
          : attribute.startOffset,
      end: attribute.endOffset,
    };
  });
  let html = final;
  for (const removal of [...removals].sort(
    (left, right) => right.start - left.start,
  ))
    html = html.slice(0, removal.start) + html.slice(removal.end);
  const adjusted = (offset: number) =>
    offset -
    removals.reduce(
      (total, removal) =>
        total + (removal.end <= offset ? removal.end - removal.start : 0),
      0,
    );
  const insertedStylesheets: InsertedComponentStylesheet[] = marked
    .filter((link) => link.active)
    .map((link) => {
      const declarer = declarations.find(
        (declaration) => declaration.physical === link.physical,
      );
      if (!declarer)
        throw new MoklyError(
          "build-invalid",
          `${route}: missing declared stylesheet provenance`,
        );
      return {
        startOffset: adjusted(link.location.startOffset),
        endOffset: adjusted(link.location.endOffset),
        path: link.publicPath,
        componentPaths: declarer.componentPaths,
      };
    })
    .sort((left, right) => left.startOffset - right.startOffset);
  for (const span of insertedStylesheets)
    if (!/^<link\b/i.test(html.slice(span.startOffset, span.endOffset)))
      throw new MoklyError(
        "build-invalid",
        `${route}: invalid inserted stylesheet span`,
      );
  return { html, view: { ...view, insertedStylesheets } };
}
