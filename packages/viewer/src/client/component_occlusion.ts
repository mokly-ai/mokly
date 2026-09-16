/** Remove areas covered by unrelated content using the live paint hit-test. */
export interface VisibleBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export function intersectBoxes(
  a: VisibleBox,
  b: VisibleBox,
): VisibleBox | undefined {
  const box = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
  return box.right > box.left && box.bottom > box.top ? box : undefined;
}
export function subtractBox(box: VisibleBox, cut: VisibleBox): VisibleBox[] {
  const overlap = intersectBoxes(box, cut);
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
  box: VisibleBox,
  range: Range,
  candidates: readonly Element[],
  rects: WeakMap<Element, readonly DOMRect[]>,
): VisibleBox[] {
  const doc = range.startContainer.ownerDocument!;
  let pieces = [box];
  for (const candidate of candidates) {
    if (!pieces.length) break;
    if (range.intersectsNode(candidate)) continue;
    if (!rects.has(candidate))
      rects.set(candidate, [...candidate.getClientRects()]);
    for (const rect of rects.get(candidate)!) {
      const overlap = intersectBoxes(box, rect);
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
