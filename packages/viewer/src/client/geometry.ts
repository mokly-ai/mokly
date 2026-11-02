/** Rectangle operations shared by frame measurement, picking, and placement. */

import type { Box } from "./frame_adapter.js";

export interface CoordinateRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Positive-area overlap; touching edges have no visible area. */
export function intersectRectangles(
  a: CoordinateRect,
  b: CoordinateRect,
): CoordinateRect | undefined {
  const box = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
  return box.right > box.left && box.bottom > box.top ? box : undefined;
}

/** Pointer hits include the boundary of a measured content box. */
export function containsPoint(box: Box, x: number, y: number): boolean {
  return (
    x >= box.x &&
    x <= box.x + box.width &&
    y >= box.y &&
    y <= box.y + box.height
  );
}
