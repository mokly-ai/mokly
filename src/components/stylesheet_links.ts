import { parse, type DefaultTreeAdapterMap } from "parse5";

import { localStylesheetHref } from "../config/stylesheet_hrefs.js";
import { MoklyError } from "../errors.js";

type Node = DefaultTreeAdapterMap["node"];
const PROVENANCE_ATTRIBUTE = "data-mokly-component-stylesheet";

/** Reserve the transient marker only when authored as an actual HTML attribute. */
export function assertNoAuthoredStylesheetToken(
  html: string,
  route: string,
): void {
  function visit(node: Node): void {
    if (
      "attrs" in node &&
      node.attrs.some((attribute) => attribute.name === PROVENANCE_ATTRIBUTE)
    )
      throw new MoklyError(
        "build-invalid",
        `${route}: renderer authored reserved ${PROVENANCE_ATTRIBUTE} attribute`,
      );
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
    if ("content" in node) visit(node.content);
  }
  visit(parse(html));
}

/** A stylesheet link may carry other rel tokens, including alternate. */
export function stylesheetLink(
  node: Node,
): node is DefaultTreeAdapterMap["element"] {
  return (
    "tagName" in node &&
    node.tagName === "link" &&
    node.attrs.some(
      (attribute) =>
        attribute.name === "rel" &&
        attribute.value
          .toLowerCase()
          .split(/[\t\n\f\r ]+/)
          .includes("stylesheet"),
    )
  );
}

function headEndOffset(
  head: DefaultTreeAdapterMap["element"],
  document: DefaultTreeAdapterMap["document"],
  html: string,
): number {
  const endTag = head.sourceCodeLocation?.endTag;
  if (endTag) return endTag.startOffset;
  const lastElement = head.childNodes
    .filter(
      (node): node is DefaultTreeAdapterMap["element"] => "tagName" in node,
    )
    .at(-1);
  if (lastElement?.sourceCodeLocation)
    return lastElement.sourceCodeLocation.endOffset;
  const body = document.childNodes
    .flatMap((node) => ("childNodes" in node ? node.childNodes : []))
    .find((node) => "tagName" in node && node.tagName === "body");
  if (body && "childNodes" in body) {
    if (body.sourceCodeLocation?.startTag)
      return body.sourceCodeLocation.startTag.startOffset;
    const first = body.childNodes.find((node) => node.sourceCodeLocation);
    if (first?.sourceCodeLocation) return first.sourceCodeLocation.startOffset;
    if (body.sourceCodeLocation) return body.sourceCodeLocation.endOffset;
  }
  return html.length;
}

/** Insert declared links beside the renderer's actual configured links. */
export function insertComponentStylesheets(
  html: string,
  route: string,
  configured: readonly string[],
  position: number,
  declared: readonly string[],
  provenance = false,
): string {
  if (!declared.length) return html;
  const document = parse(html, { sourceCodeLocationInfo: true });
  let head: DefaultTreeAdapterMap["element"] | undefined;
  const links: DefaultTreeAdapterMap["element"][] = [];
  function findHead(node: Node): void {
    if ("tagName" in node) {
      if (node.tagName === "head") head = node;
    }
    if ("childNodes" in node) node.childNodes.forEach(findHead);
  }
  findHead(document);
  if (!head)
    throw new MoklyError(
      "build-invalid",
      `${route}: cannot insert component stylesheets: missing <head>`,
    );
  function findLinks(node: Node): void {
    if ("tagName" in node) {
      if (stylesheetLink(node)) links.push(node);
    }
    if ("childNodes" in node) node.childNodes.forEach(findLinks);
  }
  findLinks(head);
  const anchors = configured.flatMap((href, index) => {
    const match = links.find((link) =>
      link.attrs.some(
        (attribute) => attribute.name === "href" && attribute.value === href,
      ),
    );
    return match?.sourceCodeLocation
      ? [{ index, location: match.sourceCodeLocation }]
      : [];
  });
  anchors.sort((left, right) => {
    const leftDistance =
      left.index < position ? position - left.index : left.index - position + 1;
    const rightDistance =
      right.index < position
        ? position - right.index
        : right.index - position + 1;
    return (
      leftDistance - rightDistance ||
      Number(right.index >= position) - Number(left.index >= position) ||
      left.index - right.index
    );
  });
  const anchor = anchors[0];
  const offset = anchor
    ? anchor.index < position
      ? anchor.location.endOffset
      : anchor.location.startOffset
    : headEndOffset(head, document, html);
  const insertion = declared
    .map(
      (file, index) =>
        `<link rel="stylesheet" href="${localStylesheetHref(route, file).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"${provenance ? ` data-mokly-component-stylesheet="${index}"` : ""}>`,
    )
    .join("");
  return html.slice(0, offset) + insertion + html.slice(offset);
}
