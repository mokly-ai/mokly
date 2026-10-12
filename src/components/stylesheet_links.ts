import type { DefaultTreeAdapterMap } from "parse5";

import { type BuildDiagnostic } from "../build/build_warnings.js";
import { missingConfiguredStylesheetLink } from "../build/warnings.js";
import { localStylesheetHref } from "../config/stylesheet_hrefs.js";
import { MoklyError } from "../errors.js";
import { parseHtmlLinks } from "../html_links.js";

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
  onWarning?: (warning: BuildDiagnostic) => void,
  diagnosticRoute = route,
): string {
  if (!declared.length) return html;
  const { document, head, links } = parseHtmlLinks(html);
  if (!head)
    throw new MoklyError(
      "build-invalid",
      `${diagnosticRoute}: cannot insert component stylesheets: missing <head>`,
    );
  const anchors = configured.flatMap((href, index) => {
    const match = links.find(
      (link) =>
        link.scope === "head" &&
        link.stylesheet &&
        link.attributes.get("href") === href,
    );
    if (!match)
      onWarning?.(missingConfiguredStylesheetLink(diagnosticRoute, href));
    return match?.location ? [{ index, location: match.location }] : [];
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
      (file) =>
        `<link rel="stylesheet" href="${localStylesheetHref(route, file).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">`,
    )
    .join("");
  return html.slice(0, offset) + insertion + html.slice(offset);
}
