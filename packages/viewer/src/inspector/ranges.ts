import { MARKER } from "./markers.js";
import type { InspectorMetadata } from "./metadata.js";
/**
 * Authenticate the complete ordered marker forest, including otherwise
 * invisible slots. A component page's root region, the tuple `[null, null]`
 * at index 0, has no marker: it is the body's content, and every marked
 * region nests in it.
 */
export const documentRanges = (
  doc: Document,
  metadata: InspectorMetadata,
): Range[] => {
  if (metadata.error) throw metadata.error;
  const walker = doc.createTreeWalker(doc, 128),
    stack: {
      __index: number;
      __node: Node;
    }[] = [],
    ranges: Range[] = [],
    root = metadata.ranges[0]?.join() === "," ? 0 : null;
  let next = 0,
    node: Node | null;
  if (root === 0)
    (ranges[next++] = doc.createRange()).selectNodeContents(doc.body);
  while ((node = walker.nextNode())) {
    const match = MARKER.exec((node as Comment).data);
    if (!match) continue;
    const id = Number(match[3]),
      record = metadata.ranges[id],
      key = record?.[0];
    if (!match[2] || !record || (match[1] === "slot") !== (key === null))
      throw "invalid-boundary";
    if (match[2] === "start") {
      if (
        id !== next++ ||
        record[1] !== (stack.at(-1)?.__index ?? root) ||
        (key && !match[4]!.includes(` instance="${key}"`))
      )
        throw "invalid-boundary";
      stack.push({ __index: id, __node: node });
    } else {
      const start = stack.pop();
      if (match[4] || start?.__index !== id) throw "invalid-boundary";
      const range = doc.createRange();
      range.setStartAfter(start.__node);
      range.setEndBefore(node);
      ranges[id] = range;
    }
  }
  if (stack.length || next !== metadata.ranges.length) throw "invalid-boundary";
  return ranges;
};
