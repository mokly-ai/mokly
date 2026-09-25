import { parse, type DefaultTreeAdapterMap } from "parse5";

import { localStylesheetHref } from "../config/stylesheet_hrefs.js";
import { MoklyError } from "../errors.js";

type Node = DefaultTreeAdapterMap["node"];

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
  const anchors = configured.map((href) => {
    const matches = links.filter((link) =>
      link.attrs.some(
        (attribute) => attribute.name === "href" && attribute.value === href,
      ),
    );
    if (matches.length !== 1 || !matches[0]!.sourceCodeLocation)
      throw new MoklyError(
        "build-invalid",
        `${route}: missing or ambiguous configured stylesheet link: ${href}`,
      );
    return matches[0]!.sourceCodeLocation!;
  });
  for (let index = 1; index < anchors.length; index++)
    if (anchors[index - 1]!.startOffset >= anchors[index]!.startOffset)
      throw new MoklyError(
        "build-invalid",
        `${route}: configured stylesheet link out of order: ${configured[index]}`,
      );
  const offset =
    anchors[position]?.startOffset ??
    anchors.at(-1)?.endOffset ??
    headEndOffset(head, document, html);
  const insertion = declared
    .map(
      (file) =>
        `<link rel="stylesheet" href="${localStylesheetHref(route, file).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">`,
    )
    .join("");
  return html.slice(0, offset) + insertion + html.slice(offset);
}
