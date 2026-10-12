/** Ignore only final subjects, including parser-implied containers and formatting clones. */
import type { DefaultTreeAdapterMap } from "parse5";

import type { SourceSpan } from "../components/material_recipe.js";

import {
  originalPageElement,
  pageCreationOffset,
} from "./page_source_locations.js";

type Element = DefaultTreeAdapterMap["element"];

export function pageSubjectFilter(
  ignored: readonly SourceSpan[],
): (element: Element) => boolean {
  const inside = (offset: number) =>
    ignored.some(({ start, end }) => start <= offset && offset < end);
  return (element) => {
    const original = originalPageElement(element);
    const offset = original.sourceCodeLocation?.startOffset;
    if (offset !== undefined) return !inside(offset);
    if (["html", "head", "body"].includes(original.tagName)) return true;
    let located = false;
    let visible = false;
    const visit = (node: DefaultTreeAdapterMap["node"]) => {
      if ("tagName" in node) {
        const start = originalPageElement(node).sourceCodeLocation?.startOffset;
        if (start !== undefined) {
          located = true;
          visible ||= !inside(start);
        }
      }
      if (!visible && "childNodes" in node)
        for (const child of node.childNodes) visit(child);
    };
    for (const child of original.childNodes) visit(child);
    return located ? visible : !inside(pageCreationOffset(original));
  };
}
