/** Locate eligible unowned inline styles in original document coordinates. */
import { html, type DefaultTreeAdapterMap } from "parse5";

import type { RenderedRange } from "../../../dist/components/ranges.js";
import { parseHtml } from "../../../dist/diagnostics/html_parse.js";
import { documentWorkSync } from "../../../dist/diagnostics/timings.js";
import { REVIEW_IGNORE_MARKER } from "../../../dist/review/ignore.js";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

/** Original source boundaries and parser input for one style element. */
export interface InlineStyleSpan {
  start: number;
  end: number;
  source: string;
  text: string;
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
  const ignored = pairedIgnoreRegions(document, pairedIgnoreIds);
  const spans: InlineStyleSpan[] = [];
  visit(document, (node) => {
    if (!isEligibleStyle(node)) return;
    const location = node.sourceCodeLocation;
    if (!location?.startTag || !location.endTag) return;
    const start = location.startTag.startOffset;
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
    const end = location.endTag.endOffset;
    spans.push({
      start,
      end,
      source: source.slice(start, end),
      text: source.slice(
        location.startTag.endOffset,
        location.endTag.startOffset,
      ),
    });
  });
  return spans.sort((a, b) => a.start - b.start);
}

function pairedIgnoreRegions(
  document: Node,
  pairedIgnoreIds: ReadonlySet<string>,
): { start: number; end: number }[] {
  const regions = new Map<string, { start?: number; end?: number }>();
  visitAll(document, (node) => {
    if (node.nodeName !== "#comment" || !("data" in node)) return;
    const marker = REVIEW_IGNORE_MARKER.exec(node.data);
    const location = node.sourceCodeLocation;
    const id = marker?.[2];
    if (!id || !location || !pairedIgnoreIds.has(id)) return;
    const region = regions.get(id) ?? {};
    if (marker[1] === "start") region.start = location.endOffset;
    else region.end = location.startOffset;
    regions.set(id, region);
  });
  return [...regions.values()].flatMap(({ start, end }) =>
    start === undefined || end === undefined ? [] : [{ start, end }],
  );
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

function visitAll(node: Node, callback: (node: Node) => void): void {
  callback(node);
  if ("childNodes" in node)
    for (const child of node.childNodes) visitAll(child, callback);
  if ("content" in node) visitAll(node.content, callback);
}
