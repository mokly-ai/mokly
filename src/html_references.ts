import path from "node:path";

import type { DefaultTreeAdapterMap } from "parse5";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { extractCssReferences } from "./css_references.js";
import { parseHtmlLinks } from "./html_links.js";

type HtmlNode = DefaultTreeAdapterMap["node"];

/** URL and fragment data extracted from one complete HTML document. */
export interface HtmlReferences {
  anchors: ReadonlySet<string>;
  hrefs: readonly string[];
  resources: readonly string[];
}

/** Whether discovery also includes speculative browser resource requests. */
export interface HtmlReferenceOptions {
  resourceHints?: boolean;
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

/** Extract navigation links, resource URLs, and anchors from HTML. */
export function extractHtmlReferences(
  content: string,
  options: HtmlReferenceOptions = {},
): HtmlReferences {
  const anchors = new Set<string>();
  const hrefs: string[] = [];
  const resources: string[] = [];
  const { document, links } = parseHtmlLinks(content);
  const activeLinks = new Map(links.map((link) => [link.element, link]));
  visit(document, (node) => {
    const link = activeLinks.get(node as DefaultTreeAdapterMap["element"]);
    const attributes =
      link?.attributes ??
      new Map(
        ("attrs" in node ? node.attrs : []).map((attribute) => [
          attribute.name,
          attribute.value,
        ]),
      );
    const tagName = "tagName" in node ? node.tagName : "";
    const id = attributes.get("id");
    if (id !== undefined) anchors.add(id);
    const href = attributes.get("href");
    const navigationHref = attributes.get("data-nav-href");
    const sourceAttributes = SOURCE_ATTRIBUTES.get(tagName) ?? [];
    if (href !== undefined && !sourceAttributes.includes("href")) {
      hrefs.push(href);
    }
    if (navigationHref !== undefined) hrefs.push(navigationHref);
    const resourceHint = link?.resourceHint;
    for (const name of options.resourceHints === false && resourceHint
      ? []
      : sourceAttributes) {
      const value = attributes.get(name);
      if (value !== undefined) resources.push(value);
    }
    const sourceSet = attributes.get("srcset");
    if (sourceSet) resources.push(...extractSourceSetReferences(sourceSet));
    const inlineStyle = attributes.get("style");
    if (inlineStyle) resources.push(...extractCssReferences(inlineStyle));
    if (tagName === "style" && "childNodes" in node) {
      const style = node.childNodes
        .map((child) => ("value" in child ? child.value : ""))
        .join("");
      resources.push(...extractCssReferences(style));
    }
  });
  return {
    anchors,
    hrefs,
    resources,
  };
}

function extractSourceSetReferences(value: string): string[] {
  return sourceSetReferences(value).map((reference) => reference.value);
}

/** Replace parsed URL spans without revisiting text written by a previous replacement. */
export function rewriteSourceSetReferences(
  value: string,
  rewrite: (reference: string) => string,
): string {
  for (const reference of sourceSetReferences(value).reverse())
    value =
      value.slice(0, reference.start) +
      rewrite(reference.value) +
      value.slice(reference.end);
  return value;
}

function sourceSetReferences(
  value: string,
): { start: number; end: number; value: string }[] {
  const references: { start: number; end: number; value: string }[] = [];
  let position = 0;
  while (position < value.length) {
    while (/[\s,]/.test(value[position] ?? "")) position += 1;
    const start = position;
    while (position < value.length && !/\s/.test(value[position] ?? "")) {
      position += 1;
    }
    const token = value.slice(start, position);
    const reference = token.replace(/,+$/, "");
    if (reference)
      references.push({
        start,
        end: start + reference.length,
        value: reference,
      });
    if (reference !== token) continue;
    while (position < value.length && value[position] !== ",") position += 1;
  }
  return references;
}

export type LocalReferencePath =
  | { kind: "resolved"; path: string }
  | { kind: "invalid-encoding" | "root-absolute" | "escape" };

/** Resolve a URL's decoded path relative to its real catalogue location. */
export function resolveLocalReferencePath(
  source: string,
  reference: string,
  allowRootAbsolute = false,
): LocalReferencePath {
  const raw = reference.split(/[?#]/, 1)[0] ?? "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { kind: "invalid-encoding" };
  }
  if (
    decoded.startsWith("\\") ||
    (decoded.startsWith("/") && !allowRootAbsolute)
  )
    return { kind: "root-absolute" };
  if (allowRootAbsolute && decoded === "/")
    return { kind: "resolved", path: "index.html" };
  const resolved = path.posix.normalize(
    decoded.startsWith("/")
      ? decoded.slice(1)
      : path.posix.join(path.posix.dirname(source), decoded),
  );
  const target = resolved.replace(/\/$/, "").replace(/^\.\//, "");
  return isSafeRepositoryPath(target)
    ? { kind: "resolved", path: target }
    : { kind: "escape" };
}

function visit(node: HtmlNode, callback: (node: HtmlNode) => void): void {
  callback(node);
  if ("childNodes" in node)
    for (const child of node.childNodes) visit(child, callback);
}
