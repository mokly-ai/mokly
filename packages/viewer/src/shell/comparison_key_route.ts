/**
 * Find the inner scroll region a scroll key pressed inside a comparison pane
 * belongs to: the nearest region, from the focused element or the element the
 * reader last pressed a pointer on, that can still move in the key's
 * direction. The browser scrolls that region itself.
 */

import {
  isInnerRegion,
  regionRange,
  scrollsOn,
} from "./comparison_scroll_regions.js";

/** The direction a scroll key moves content into view. */
export type ScrollDirection = "down" | "left" | "right" | "up";

/** The direction of a scroll key, or `undefined` for any other key. */
export function scrollKeyDirection(
  key: string,
  shiftKey: boolean,
): ScrollDirection | undefined {
  switch (key) {
    case " ":
      return shiftKey ? "up" : "down";
    case "PageDown":
    case "ArrowDown":
    case "End":
      return "down";
    case "PageUp":
    case "ArrowUp":
    case "Home":
      return "up";
    case "ArrowRight":
      return "right";
    case "ArrowLeft":
      return "left";
    default:
      return;
  }
}

/**
 * Where a scroll key starts: the focused element unless it is the root or
 * body, otherwise the last connected pointer target in that document.
 */
export function keyStart(
  doc: Document,
  pointer: Element | undefined,
): Element | undefined {
  const focused = doc.activeElement;
  if (focused && focused !== doc.documentElement && focused !== doc.body)
    return focused;
  return pointer?.isConnected && pointer.ownerDocument === doc
    ? pointer
    : undefined;
}

/**
 * Whether a region can still move in a direction on an axis it lets a reader
 * scroll. A right-to-left region's horizontal offset runs from zero down to
 * minus its range.
 */
export function canMove(region: Element, direction: ScrollDirection): boolean {
  const style = region.ownerDocument.defaultView?.getComputedStyle(region);
  const range = regionRange(region);
  if (direction === "down" || direction === "up") {
    if (!scrollsOn(style?.overflowY)) return false;
    return direction === "down"
      ? region.scrollTop < range.y
      : region.scrollTop > 0;
  }
  if (!scrollsOn(style?.overflowX)) return false;
  const rtl = style?.direction === "rtl";
  if (direction === "right")
    return rtl ? region.scrollLeft < 0 : region.scrollLeft < range.x;
  return rtl ? region.scrollLeft > -range.x : region.scrollLeft > 0;
}

/** The nearest region, from an element through its ancestors, that can move. */
export function movableRegion(
  start: Element,
  direction: ScrollDirection,
): Element | undefined {
  for (let node: Element | null = start; node; node = node.parentElement)
    if (isInnerRegion(node) && canMove(node, direction)) return node;
  return;
}
