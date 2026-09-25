import { parse } from "parse5";

import {
  decodeCssIdentifier,
  tokenizeCss,
  type CssSourceToken,
} from "./review/css/source.js";

interface HtmlAttribute {
  name: string;
  value: string;
}

interface HtmlNode {
  attrs?: HtmlAttribute[];
  childNodes?: HtmlNode[];
  tagName?: string;
  value?: string;
}

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

const SOURCE_ATTRIBUTES = new Map<string, readonly string[]>([
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
  visit(parse(content) as unknown as HtmlNode, (node) => {
    const attributes = new Map(
      (node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]),
    );
    const id = attributes.get("id");
    if (id !== undefined) anchors.add(id);
    const href = attributes.get("href");
    const navigationHref = attributes.get("data-nav-href");
    const sourceAttributes = SOURCE_ATTRIBUTES.get(node.tagName ?? "") ?? [];
    if (href !== undefined && !sourceAttributes.includes("href")) {
      hrefs.push(href);
    }
    if (navigationHref !== undefined) hrefs.push(navigationHref);
    const resourceHint =
      node.tagName === "link" &&
      /(?:^|\s)(?:preload|modulepreload|prefetch|preconnect|dns-prefetch)(?:\s|$)/i.test(
        attributes.get("rel") ?? "",
      ) &&
      !/(?:^|\s)stylesheet(?:\s|$)/i.test(attributes.get("rel") ?? "");
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
    if (node.tagName === "style") {
      const style = (node.childNodes ?? [])
        .map((child) => child.value ?? "")
        .join("");
      resources.push(...extractCssReferences(style));
    }
  });
  return { anchors, hrefs, resources };
}

/** Extract `url()` and string-form `@import` references from CSS. */
export function extractCssReferences(content: string): string[] {
  if (!/url\(|image-set\(|@import|\\/i.test(content)) return [];
  const tokens = tokenizeCss(content, { allowIncomplete: true });
  const references: { start: number; value: string }[] = [
    ...imageSetStringReferences(tokens),
  ];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    const next = tokens[index + 1];
    if (!token.word && token.value.endsWith(")")) {
      const opening = token.value.indexOf("(");
      if (
        opening >= 0 &&
        decodeCssIdentifier(token.value.slice(0, opening)).toLowerCase() ===
          "url"
      )
        references.push({
          start: token.start,
          value: decodeCssIdentifier(token.value.slice(opening + 1, -1)),
        });
    } else if (
      token.word &&
      decodeCssIdentifier(token.value).toLowerCase() === "url" &&
      next?.value === "(" &&
      next.start === token.end
    ) {
      const value = tokens[index + 2]?.value;
      if (value && /^["']/.test(value) && tokens[index + 3]?.value === ")") {
        references.push({
          start: token.start,
          value: decodeCssIdentifier(value.slice(1, -1)),
        });
        index += 3;
      }
    } else if (
      token.value === "@" &&
      next?.start === token.end &&
      decodeCssIdentifier(next.value).toLowerCase() === "import"
    ) {
      const value = tokens[index + 2]?.value;
      if (value && /^["']/.test(value)) {
        references.push({
          start: token.start,
          value: decodeCssIdentifier(value.slice(1, -1)),
        });
        index += 2;
      }
    }
  }
  return references
    .sort((left, right) => left.start - right.start)
    .map(({ value }) => value);
}

/** String-form image-set sources are not sent through esbuild's url-token resolver. */
export function extractImageSetStringReferences(content: string): string[] {
  if (!/image-set\(/i.test(content)) return [];
  return imageSetStringReferences(
    tokenizeCss(content, { allowIncomplete: true }),
  ).map(({ value }) => value);
}

function imageSetStringReferences(
  tokens: readonly CssSourceToken[],
): { start: number; value: string }[] {
  const references: { start: number; value: string }[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const next = tokens[index + 1];
    if (
      !token.word ||
      !["image-set", "-webkit-image-set"].includes(
        decodeCssIdentifier(token.value).toLowerCase(),
      ) ||
      next?.value !== "(" ||
      next.start !== token.end
    )
      continue;
    let depth = 1;
    for (let cursor = index + 2; cursor < tokens.length && depth; cursor += 1) {
      const current = tokens[cursor]!;
      if (current.value === "(") depth += 1;
      else if (current.value === ")") depth -= 1;
      else if (depth === 1 && /^['"]/.test(current.value))
        references.push({
          start: current.start,
          value: decodeCssIdentifier(current.value.slice(1, -1)),
        });
    }
  }
  return references;
}

function extractSourceSetReferences(value: string): string[] {
  const references: string[] = [];
  let position = 0;
  while (position < value.length) {
    while (/[\s,]/.test(value[position] ?? "")) position += 1;
    const start = position;
    while (position < value.length && !/\s/.test(value[position] ?? "")) {
      position += 1;
    }
    const token = value.slice(start, position);
    const reference = token.replace(/,+$/, "");
    if (reference) references.push(reference);
    if (reference !== token) continue;
    while (position < value.length && value[position] !== ",") position += 1;
  }
  return references;
}

function visit(node: HtmlNode, callback: (node: HtmlNode) => void): void {
  callback(node);
  for (const child of node.childNodes ?? []) visit(child, callback);
}
