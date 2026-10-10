/** Locate eligible unowned inline styles in original document coordinates. */
import { html, type DefaultTreeAdapterMap } from "parse5";

import type { RenderedRange } from "../../components/ranges.js";
import { parseHtml } from "../../diagnostics/html_parse.js";
import { documentWorkSync } from "../../diagnostics/timings.js";
import { reviewIgnoreRegions } from "../ignore.js";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

/** Original source boundaries and parser input for one style element. */
export interface InlineStyleSpan {
  start: number;
  end: number;
  source: string;
  text: string;
  contentStart?: number;
  contentEnd?: number;
}

/** Whether both documents expose the same ordered style-element source bytes. */
export function sameInlineOuterSources(
  before: readonly InlineStyleSpan[],
  after: readonly InlineStyleSpan[],
): boolean {
  return (
    before.length === after.length &&
    before.every((span, index) => span.source === after[index]?.source)
  );
}

/** Find HTML CSS style elements outside ownership and paired ignored regions. */
export function findUnownedInlineStyles(
  source: string,
  ranges: readonly RenderedRange[],
  pairedIgnoreIds: ReadonlySet<string>,
): InlineStyleSpan[] {
  return documentWorkSync("styleDiscoveryMs", () =>
    findStyles(source, ranges, pairedIgnoreIds),
  );
}

function findStyles(
  source: string,
  ranges: readonly RenderedRange[],
  pairedIgnoreIds: ReadonlySet<string>,
): InlineStyleSpan[] {
  const document = parseHtml("styleDiscovery", source, {
    sourceCodeLocationInfo: true,
  });
  const ignored = reviewIgnoreRegions(source, "$document").filter(({ id }) =>
    pairedIgnoreIds.has(id),
  );
  const spans: InlineStyleSpan[] = [];
  visit(document, (node) => {
    const span = inlineStyleSpan(source, node);
    if (!span) return;
    const { start } = span;
    if (
      ignored.some((region) => region.start <= start && start < region.end) ||
      ranges.some(
        (range) =>
          range.record.target.kind !== "root" &&
          range.contentStart <= start &&
          start < range.contentEnd,
      )
    )
      return;
    spans.push(span);
  });
  return spans.sort((a, b) => a.start - b.start);
}

export function inlineStyleSpan(
  source: string,
  node: Node,
): InlineStyleSpan | undefined {
  if (!isEligibleStyle(node)) return;
  const location = node.sourceCodeLocation;
  if (!location?.startTag || !location.endTag) return;
  const start = location.startTag.startOffset;
  const end = location.endTag.endOffset;
  return {
    start,
    end,
    contentStart: location.startTag.endOffset,
    contentEnd: location.endTag.startOffset,
    source: source.slice(start, end),
    text: source.slice(
      location.startTag.endOffset,
      location.endTag.startOffset,
    ),
  };
}

function isEligibleStyle(node: Node): node is Element {
  if (
    !("tagName" in node) ||
    node.tagName !== "style" ||
    node.namespaceURI !== html.NS.HTML
  )
    return false;
  const type = node.attrs.find((attribute) => attribute.name === "type")?.value;
  return (
    !node.attrs.some((attribute) => attribute.name === "media") &&
    (type === undefined || type === "" || asciiLower(type) === "text/css")
  );
}

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function visit(node: Node, callback: (node: Node) => void): void {
  callback(node);
  if ("childNodes" in node)
    for (const child of node.childNodes) visit(child, callback);
}
