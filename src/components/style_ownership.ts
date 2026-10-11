import { parse, type DefaultTreeAdapterMap } from "parse5";

import type { ComponentStyleOwnership } from "@mokly/viewer";
import { invalidData } from "@mokly/viewer/data";

import type { TextOffsetMap } from "../text_patches.js";

type Node = DefaultTreeAdapterMap["node"];
interface StyleText {
  start: number;
  end: number;
  text: string;
}

/** Authenticate style text and map its exact range through the reported edits. */
export function rebaseStyleOwnership(
  edits: TextOffsetMap,
  ownership: readonly ComponentStyleOwnership[],
): ComponentStyleOwnership[] {
  if (!ownership.length) return [];
  const original = styleTexts(edits.source);
  const updated = styleTexts(edits.html);
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
    const source = original.find(
      (style) =>
        style.start <= record.startOffset && style.end >= record.endOffset,
    );
    if (!source)
      invalidData(
        "$styles",
        "ownership must name preserved text inside a style element",
      );
    const mappedStyle = edits.range(source.start, source.end);
    const target = updated.find(
      (style) =>
        style.start === mappedStyle.start && style.end === mappedStyle.end,
    );
    if (!target || source.text !== target.text)
      invalidData(
        "$styles",
        "ownership must name preserved text inside a style element",
      );
    previousEnd = record.endOffset;
    const mapped = edits.range(record.startOffset, record.endOffset);
    return {
      ...record,
      startOffset: mapped.start,
      endOffset: mapped.end,
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
