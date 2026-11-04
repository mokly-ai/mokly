/** Clip immediate frames to the host viewport and their actual ancestors. */

import {
  clipNode,
  intersectRectangles,
  type CoordinateRect,
} from "@mokly/frame/internal";

function clipAncestors(
  box: CoordinateRect,
  node: Node,
): CoordinateRect | undefined {
  const [left, top, right, bottom] = clipNode(node, [
    box.left,
    box.top,
    box.right,
    box.bottom,
  ]);
  return intersectRectangles(box, { left, top, right, bottom });
}
export function visibleFrameBox(
  frame: HTMLIFrameElement,
): CoordinateRect | undefined {
  const win = frame.ownerDocument.defaultView!;
  const bounds = frame.getBoundingClientRect();
  const viewport = intersectRectangles(bounds, {
    left: 0,
    top: 0,
    right: win.innerWidth,
    bottom: win.innerHeight,
  });
  return viewport ? clipAncestors(viewport, frame) : undefined;
}
