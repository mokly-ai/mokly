import type { Box } from "../frame_adapter.js";

import { boundedBox, combineEdges, edges, type Edges } from "./clipping.js";
import { nodeRects } from "./geometry.js";

const SHOW_ELEMENT_AND_TEXT = 5;
const FILTER_REJECT = 2;
const FILTER_SKIP = 3;

export function contentBox(doc: Document): Box | null {
  let bounds: Edges | undefined;
  // The filter accepts no nodes, so this call visits the whole subtree.
  if (doc.body)
    doc
      .createTreeWalker(doc.body, SHOW_ELEMENT_AND_TEXT, (node) => {
        const rects = nodeRects(doc, node);
        for (const rect of rects)
          if (rect.width > 0 && rect.height > 0)
            bounds = bounds
              ? combineEdges(bounds, edges(rect), true)
              : edges(rect);
        return rects.length ? FILTER_REJECT : FILTER_SKIP;
      })
      .nextNode();
  const win = doc.defaultView!;
  return bounds
    ? boundedBox(
        bounds[0] + win.scrollX,
        bounds[1] + win.scrollY,
        bounds[2] - bounds[0],
        bounds[3] - bounds[1],
      )
    : null;
}
