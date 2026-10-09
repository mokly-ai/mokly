/** Shared decoded reference tokens; source locations belong to their caller. */
import { extractCssReferences } from "./css_references.js";
import { linkRelTokens } from "./html_links.js";
import type { HtmlReferenceOptions } from "./html_references.js";
import { extractSourceSetReferences } from "./source_set_references.js";

export interface ReferenceNode {
  nodeName?: string;
  attrs?: readonly { name: string; value: string }[];
  childNodes?: readonly ReferenceNode[];
  tagName?: string;
  value?: string;
}

export interface HtmlReferenceValue {
  kind:
    | "anchor"
    | "navigation"
    | "source"
    | "srcset"
    | "styleAttribute"
    | "styleText";
  value: string;
  attribute?: string;
}

export const SOURCE_ATTRIBUTES = new Map<string, readonly string[]>([
  ["audio", ["src"]],
  ["embed", ["src"]],
  ["iframe", ["src"]],
  ["image", ["href", "xlink:href"]],
  ["img", ["src"]],
  ["input", ["src"]],
  ["link", ["href"]],
  ["object", ["data"]],
  ["script", ["src"]],
  ["source", ["src"]],
  ["track", ["src"]],
  ["use", ["href", "xlink:href"]],
  ["video", ["poster", "src"]],
]);

export function htmlReferenceValues(
  node: ReferenceNode,
  options: HtmlReferenceOptions,
): HtmlReferenceValue[] {
  const attributes = new Map(
    (node.attrs ?? []).map(({ name, value }) => [name, value]),
  );
  const result: HtmlReferenceValue[] = [];
  const add = (kind: HtmlReferenceValue["kind"], attribute: string) => {
    const value = attributes.get(attribute);
    if (value !== undefined) result.push({ kind, attribute, value });
  };
  add("anchor", "id");
  const sources = SOURCE_ATTRIBUTES.get(node.tagName ?? "") ?? [];
  if (!sources.includes("href")) add("navigation", "href");
  add("navigation", "data-nav-href");
  const rel = linkRelTokens(node.attrs ?? []);
  const resourceHint =
    node.tagName === "link" &&
    !rel.includes("stylesheet") &&
    rel.some((token) =>
      [
        "preload",
        "modulepreload",
        "prefetch",
        "preconnect",
        "dns-prefetch",
      ].includes(token),
    );
  if (options.resourceHints !== false || !resourceHint)
    for (const name of sources) add("source", name);
  for (const value of extractSourceSetReferences(
    attributes.get("srcset") ?? "",
  ))
    result.push({ kind: "srcset", attribute: "srcset", value });
  for (const value of extractCssReferences(attributes.get("style") ?? ""))
    result.push({ kind: "styleAttribute", attribute: "style", value });
  if (node.tagName === "style")
    for (const value of extractCssReferences(
      (node.childNodes ?? []).map((child) => child.value ?? "").join(""),
    ))
      result.push({ kind: "styleText", value });
  return result;
}
