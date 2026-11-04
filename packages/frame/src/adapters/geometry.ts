/** Rectangle operations shared by frame measurement, picking, and placement. */

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
