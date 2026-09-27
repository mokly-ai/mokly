/**
 * Reveal a same-document anchor target inside the inner scroll regions that
 * enclose it, innermost first, moving each as little as possible.
 */

import type { ScrollOffset } from "./comparison_scroll_mirror.js";
import { isInnerRegion } from "./comparison_scroll_regions.js";

/**
 * How far to move one axis so a target shows inside a visible span: to its
 * start edge when it starts before the span or is larger than it, to its end
 * edge when it ends after the span, and not at all when it already shows.
 */
export function nearestEdge(
  start: number,
  end: number,
  from: number,
  size: number,
): number {
  if (start < from || end - start > size) return start - from;
  if (end > from + size) return end - (from + size);
  return 0;
}

/** The inner regions strictly enclosing a target, innermost first. */
export function enclosingRegions(target: Element): Element[] {
  const regions: Element[] = [];
  for (let node = target.parentElement; node; node = node.parentElement)
    if (isInnerRegion(node)) regions.push(node);
  return regions;
}

/**
 * The offset that shows a target inside a region: the region's visible box
 * starts at its border box plus `clientLeft`/`clientTop` and spans
 * `clientWidth` by `clientHeight`.
 */
export function revealOffset(region: Element, target: Element): ScrollOffset {
  const box = region.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  return {
    x:
      region.scrollLeft +
      nearestEdge(
        rect.left,
        rect.right,
        box.left + region.clientLeft,
        region.clientWidth,
      ),
    y:
      region.scrollTop +
      nearestEdge(
        rect.top,
        rect.bottom,
        box.top + region.clientTop,
        region.clientHeight,
      ),
  };
}
