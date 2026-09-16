interface DocumentRange {
  id: string;
  key?: string;
  parentId?: string;
}

export interface AuthenticatedRanges {
  doc: Document;
  ranges: ReadonlyMap<string, readonly Range[]>;
  byId: ReadonlyMap<string, Range>;
}

/** Authenticate every pair and its physical parent before exposing any range. */
export function authenticateDocumentRanges(
  doc: Document,
  records: readonly DocumentRange[],
): AuthenticatedRanges | undefined {
  const walker = doc.createTreeWalker(doc, 128);
  const stack: { id: string; node: Node }[] = [];
  const ranges = new Map<string, Range[]>();
  const byId = new Map<string, Range>();
  const lookup = new Map(records.map((record) => [record.id, record]));
  let next = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? "";
    if (!text.startsWith("mokly-component:")) continue;
    const match = /^mokly-component:(start|end):(r-[0-9]+)$/.exec(text);
    if (!match) return;
    const record = lookup.get(match[2]!);
    if (!record) return;
    if (match[1] === "start") {
      if (
        records[next++]?.id !== record.id ||
        record.parentId !== stack.at(-1)?.id
      )
        return;
      stack.push({ id: record.id, node });
    } else {
      const start = stack.pop();
      if (start?.id !== record.id) return;
      const range = doc.createRange();
      range.setStartAfter(start.node);
      range.setEndBefore(node);
      byId.set(record.id, range);
      if (record.key)
        ranges.set(record.key, [...(ranges.get(record.key) ?? []), range]);
    }
  }
  if (stack.length || next !== records.length) return;
  return { doc, ranges, byId };
}
