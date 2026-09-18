import type { InspectorMetadata } from "./metadata.js";
/** Authenticate the complete ordered marker forest, including otherwise invisible slots. */
export const documentRanges = (
  doc: Document,
  metadata: InspectorMetadata,
): Range[] => {
  if (metadata.error) throw metadata.error;
  const walker = doc.createTreeWalker(doc, 128),
    stack: {
      __index: number;
      __node: Node;
    }[] = [];
  const ranges: Range[] = [];
  let next = 0,
    node: Node | null;
  while ((node = walker.nextNode())) {
    const text = (node as Comment).data;
    if (!text.startsWith("mokly-component:")) continue;
    const match = /^mokly-component:(start|end):r-(0|[1-9]\d*)$/.exec(text);
    const id = Number(match?.[2]),
      record = metadata.ranges[id];
    if (!match || !record) throw "invalid-boundary";
    if (match[1] === "start") {
      if (id !== next++ || record[1] !== (stack.at(-1)?.__index ?? null))
        throw "invalid-boundary";
      stack.push({ __index: id, __node: node });
    } else {
      const start = stack.pop();
      if (start?.__index !== id) throw "invalid-boundary";
      const range = doc.createRange();
      range.setStartAfter(start.__node);
      range.setEndBefore(node);
      ranges[id] = range;
    }
  }
  if (stack.length || next !== metadata.ranges.length) throw "invalid-boundary";
  return ranges;
};
