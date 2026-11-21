import { MARKER } from "./markers.js";
import type { ProbeMetadata } from "./metadata.js";
/**
 * Authenticate the complete ordered marker forest, including otherwise
 * invisible slots. A component page's root region, the tuple `[null, null]`
 * at index 0, has no marker: it is the body's content, and every marked
 * region nests in it.
 */
export const documentRanges = (
  doc: Document,
  metadata: ProbeMetadata,
): Range[] => {
  if (metadata.error) throw metadata.error;
  const walker = doc.createTreeWalker(doc, 128),
    stack: number[] = [],
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
        record[1] !== (stack.at(-1) ?? root) ||
        (key && !match[4]!.includes(` instance="${key}"`))
      )
        throw "invalid-boundary";
      const range = doc.createRange();
      range.setStartAfter(node);
      ranges[id] = range;
      stack.push(id);
    } else {
      if (match[4] || stack.pop() !== id) throw "invalid-boundary";
      ranges[id]!.setEndBefore(node);
    }
  }
  if (stack.length || next !== metadata.ranges.length) throw "invalid-boundary";
  return ranges;
};
