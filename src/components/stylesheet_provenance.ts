import { parse, type DefaultTreeAdapterMap } from "parse5";

import type {
  ComponentViewRecord,
  InsertedComponentStylesheet,
} from "@mokly/viewer";

import { MoklyError } from "../errors.js";

import type { LinkedComponentStylesheet } from "./render.js";
import { stylesheetLink } from "./stylesheet_links.js";
import { publicFileFromHref } from "./stylesheet_reuse.js";

type Node = DefaultTreeAdapterMap["node"];
type Location = NonNullable<
  DefaultTreeAdapterMap["element"]["sourceCodeLocation"]
>;
const ATTRIBUTE = "data-mokly-component-stylesheet";

interface LinkedFile {
  href: string;
  physical: string;
  publicPath: string;
  location: Location;
  token?: string;
  attribute?: { startOffset: number; endOffset: number };
}

function links(html: string, route: string, mockupsDir: string): LinkedFile[] {
  const found: LinkedFile[] = [];
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
      if (stylesheetLink(node) && node.sourceCodeLocation) {
        const href = node.attrs.find(
          (attribute) => attribute.name === "href",
        )?.value;
        const file = href && publicFileFromHref(href, route, mockupsDir);
        if (token && (!file || !node.sourceCodeLocation.attrs?.[ATTRIBUTE]))
          throw new MoklyError(
            "build-invalid",
            `${route}: invalid ${ATTRIBUTE} link`,
          );
        if (file)
          found.push({
            href: href!,
            physical: file.physicalPath,
            publicPath: file.publicPath,
            location: node.sourceCodeLocation,
            ...(token
              ? {
                  token: token.value,
                  attribute: node.sourceCodeLocation.attrs![ATTRIBUTE]!,
                }
              : {}),
          });
      }
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
    if ("content" in node) visit(node.content);
  }
  visit(parse(html, { sourceCodeLocationInfo: true }));
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
    links(before, route, mockupsDir)
      .filter((link) => link.token !== undefined)
      .map((link) => [link.token!, link.physical]),
  );
  const finalLinks = links(final, route, mockupsDir);
  const marked = finalLinks.filter((link) => link.token !== undefined);
  const seen = new Set<string>();
  for (const link of marked) {
    if (
      !/^(0|[1-9][0-9]*)$/.test(link.token!) ||
      seen.has(link.token!) ||
      issued.get(link.token!) !== link.physical
    )
      throw new MoklyError(
        "build-invalid",
        `${route}: ambiguous ${ATTRIBUTE} token`,
      );
    seen.add(link.token!);
  }
  const removals = marked.map((link) => {
    const attribute = link.attribute!;
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
        componentIds: declarer.componentIds,
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
