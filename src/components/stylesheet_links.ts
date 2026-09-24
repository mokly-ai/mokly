import { parse, type DefaultTreeAdapterMap } from "parse5";

import { localStylesheetHref } from "../config/stylesheet_hrefs.js";
import { MoklyError } from "../errors.js";

type Node = DefaultTreeAdapterMap["node"];

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
  if (!head?.sourceCodeLocation?.endTag)
    throw new MoklyError(
      "build-invalid",
      `${route}: cannot insert component stylesheets: missing <head>`,
    );
  function findLinks(node: Node): void {
    if ("tagName" in node) {
      if (
        node.tagName === "link" &&
        node.attrs.some(
          (attribute) =>
            attribute.name === "rel" &&
            attribute.value.toLowerCase().split(/\s+/).includes("stylesheet"),
        )
      )
        links.push(node);
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
    head.sourceCodeLocation.endTag.startOffset;
  const insertion = declared
    .map(
      (file) =>
        `<link rel="stylesheet" href="${localStylesheetHref(route, file).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">`,
    )
    .join("");
  return html.slice(0, offset) + insertion + html.slice(offset);
}
