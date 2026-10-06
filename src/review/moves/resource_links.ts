import { parse, type DefaultTreeAdapterMap } from "parse5";

import { rewriteCssReferences } from "../../css_references.js";
import { isMoklyError } from "../../errors.js";
import { SOURCE_ATTRIBUTES } from "../../html_reference_values.js";
import { rewriteSourceSetReferences } from "../../source_set_references.js";
import { resolveResourceReference } from "../asset_references.js";

import { resourceUrl, type MoveResources, type MoveSide } from "./resources.js";

type Node = DefaultTreeAdapterMap["node"];

/** Normalize local resource spellings without changing the document used for capture or selectors. */
export function normalizeResourceLinks(
  html: string,
  source: string,
  side: MoveSide,
  resources?: MoveResources,
  counterpart?: string,
): string {
  const patches: { start: number; end: number; value: string }[] = [];
  const url = (value: string): string => {
    const route = comparisonResource(source, value);
    return route
      ? resourceUrl(
          resources?.identity(side, route, counterpart) ?? route,
          value,
        )
      : value;
  };
  const css = (value: string) => rewriteCssReferences(value, url);
  const visit = (node: Node): void => {
    if ("attrs" in node) {
      for (const attr of node.attrs) {
        const name = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;
        let value = attr.value;
        if ((SOURCE_ATTRIBUTES.get(node.tagName) ?? []).includes(name))
          value = url(value);
        else if (name === "style") value = css(value);
        else if (name === "srcset") {
          value = rewriteSourceSetReferences(value, url);
        } else if (
          (node.tagName === "a" || node.tagName === "area") &&
          name === "href" &&
          !value.startsWith("mock:")
        ) {
          const route = comparisonResource(source, value);
          if (route && resources?.[side].has(route)) value = url(value);
        }
        const location = node.sourceCodeLocation?.attrs?.[name];
        if (value !== attr.value && location)
          patches.push({
            start: location.startOffset,
            end: location.endOffset,
            value: `${name}="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`,
          });
      }
      if (node.tagName === "style")
        for (const child of node.childNodes) {
          if (!("value" in child) || !child.sourceCodeLocation) continue;
          const value = css(child.value);
          if (value !== child.value)
            patches.push({
              start: child.sourceCodeLocation.startOffset,
              end: child.sourceCodeLocation.endOffset,
              value,
            });
        }
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
    if ("content" in node) visit(node.content);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  for (const patch of patches.sort((a, b) => b.start - a.start))
    html = html.slice(0, patch.start) + patch.value + html.slice(patch.end);
  return html;
}

/** Resource traversal owns validation and diagnostic order; equality never admits an unsafe URL. */
function comparisonResource(source: string, value: string): string | undefined {
  try {
    return resolveResourceReference(source, value);
  } catch (error) {
    if (isMoklyError(error) && error.code === "review-invalid") return;
    throw error;
  }
}
