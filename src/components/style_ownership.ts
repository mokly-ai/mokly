import { parse, type DefaultTreeAdapterMap } from "parse5";

import type { ComponentStyleOwnership } from "@mokly/viewer";
import { invalidData } from "@mokly/viewer/data";

type Node = DefaultTreeAdapterMap["node"];
interface StyleText {
  start: number;
  end: number;
  text: string;
}

/** Ownership survives source headers/link edits only if its style text is preserved. */
export function rebaseStyleOwnership(
  before: string,
  after: string,
  ownership: readonly ComponentStyleOwnership[],
): ComponentStyleOwnership[] {
  if (!ownership.length) return [];
  const original = styleTexts(before);
  const updated = styleTexts(after);
  let previousEnd = -1;
  return ownership.map((record) => {
    if (
      !Number.isSafeInteger(record.startOffset) ||
      !Number.isSafeInteger(record.endOffset) ||
      record.startOffset < previousEnd ||
      record.endOffset <= record.startOffset
    )
      invalidData(
        "$styles",
        "invalid, overlapping or unordered style ownership",
      );
    const index = original.findIndex(
      (style) =>
        style.start <= record.startOffset && style.end >= record.endOffset,
    );
    const source = original[index];
    const target = updated[index];
    if (!source || !target || source.text !== target.text)
      invalidData(
        "$styles",
        "ownership must name preserved text inside a style element",
      );
    previousEnd = record.endOffset;
    const adjustment = target.start - source.start;
    return {
      ...record,
      startOffset: record.startOffset + adjustment,
      endOffset: record.endOffset + adjustment,
    };
  });
}

function styleTexts(html: string): StyleText[] {
  const result: StyleText[] = [];
  function visit(node: Node): void {
    if ("tagName" in node && node.tagName === "style") {
      const location = node.sourceCodeLocation;
      if (location?.startTag && location.endTag) {
        const start = location.startTag.endOffset;
        const end = location.endTag.startOffset;
        result.push({ start, end, text: html.slice(start, end) });
      }
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  visit(parse(html, { sourceCodeLocationInfo: true }));
  return result;
}
