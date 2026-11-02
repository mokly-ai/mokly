/** Remove areas covered by unrelated content using the live paint hit-test. */
import { intersectRectangles, type CoordinateRect } from "./geometry.js";

function subtractBox(
  box: CoordinateRect,
  cut: CoordinateRect,
): CoordinateRect[] {
  const overlap = intersectRectangles(box, cut);
  if (!overlap) return [box];
  return [
    { ...box, bottom: overlap.top },
    { ...box, top: overlap.bottom },
    {
      left: box.left,
      top: overlap.top,
      right: overlap.left,
      bottom: overlap.bottom,
    },
    {
      left: overlap.right,
      top: overlap.top,
      right: box.right,
      bottom: overlap.bottom,
    },
  ].filter((value) => value.right > value.left && value.bottom > value.top);
}
export function uncoveredBoxes(
  box: CoordinateRect,
  range: Range,
  candidates: readonly Element[],
  rects: WeakMap<Element, readonly DOMRect[]>,
): CoordinateRect[] {
  const doc = range.startContainer.ownerDocument!;
  let pieces = [box];
  for (const candidate of candidates) {
    if (!pieces.length) break;
    if (range.intersectsNode(candidate)) continue;
    if (!rects.has(candidate))
      rects.set(candidate, [...candidate.getClientRects()]);
    for (const rect of rects.get(candidate)!) {
      const overlap = intersectRectangles(box, rect);
      if (!overlap) continue;
      const hit = doc.elementFromPoint(
        (overlap.left + overlap.right) / 2,
        (overlap.top + overlap.bottom) / 2,
      );
      if (hit && candidate.contains(hit))
        pieces = pieces.flatMap((piece) => subtractBox(piece, rect));
    }
  }
  return pieces;
}
