import type { Box } from "../frame_adapter.js";

import {
  boundedPixel,
  clipNode,
  combineEdges,
  edges,
  viewport,
  type Edges,
} from "./clipping.js";
export const hasText = (text: Text): boolean => /[^\t\n\f\r ]/.test(text.data);
export const nodeRects = (doc: Document, node: Node): DOMRectList => {
  if (node.nodeType === 1) return (node as Element).getClientRects();
  const range = doc.createRange();
  range.selectNodeContents(node);
  return range.getClientRects();
};
const visible = (box: Edges) => box[2] > box[0] && box[3] > box[1];
/** Read actual element/text rectangles, clipping each node's own ancestors. */
export const geometry = (doc: Document) => {
  const frame = viewport(doc);
  frame.forEach((value) => boundedPixel(value));
  const candidates = [...doc.querySelectorAll("body *")].map(
    (node) => [node, node.getClientRects()] as const,
  );
  return (range: Range): Box[] => {
    const walker = doc.createTreeWalker(range.commonAncestorContainer, 5);
    const result: Edges[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (range.comparePoint(node, 0)) continue;
      const clip = clipNode(node, frame);
      for (const rect of nodeRects(doc, node)) {
        const box = combineEdges(edges(rect), clip);
        if (!visible(box)) continue;
        let pieces = [box];
        for (const [candidate, rects] of candidates) {
          if (range.intersectsNode(candidate)) continue;
          for (const rect of rects) {
            const cut = combineEdges(box, edges(rect));
            if (
              !visible(cut) ||
              !candidate.contains(
                doc.elementFromPoint(
                  (cut[0] + cut[2]) / 2,
                  (cut[1] + cut[3]) / 2,
                ),
              )
            )
              continue;
            pieces = pieces.flatMap((piece) => {
              const overlap = combineEdges(piece, cut);
              if (!visible(overlap)) return [piece];
              const [left, top, right, bottom] = piece;
              const [cutLeft, cutTop, cutRight, cutBottom] = overlap;
              const remainder: Edges[] = [
                [left, top, right, cutTop],
                [left, cutBottom, right, bottom],
                [left, cutTop, cutLeft, cutBottom],
                [cutRight, cutTop, right, cutBottom],
              ];
              return remainder.filter(visible);
            });
          }
        }
        result.push(...pieces);
      }
    }
    return result
      .filter(
        (box, index) =>
          !result.some(
            (other, j) =>
              box.every((value, axis) =>
                axis < 2 ? value >= other[axis]! : value <= other[axis]!,
              ) &&
              (j < index || other.some((value, axis) => value !== box[axis])),
          ),
      )
      .map(([x, y, right, bottom]) => ({
        x,
        y,
        width: right - x,
        height: bottom - y,
      }));
  };
};
