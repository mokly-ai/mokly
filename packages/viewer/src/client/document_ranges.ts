import type { ComponentRangeRecord } from "../components/manifest_types.js";
import { MARKER } from "../inspector/markers.js";

interface DocumentRange {
  id: string;
  key?: string;
  parentId?: string;
  /** A component page's root region, which carries no marker. */
  root?: boolean;
}

/** The records the reader checks, from one view's usage ranges. */
export function documentRangeRecords(
  ranges: readonly ComponentRangeRecord[],
): DocumentRange[] {
  return ranges.map((range) => ({
    id: range.id,
    ...(range.parentId ? { parentId: range.parentId } : {}),
    ...(range.target.kind === "instance"
      ? { key: range.target.instanceKey }
      : {}),
    ...(range.target.kind === "root" ? { root: true } : {}),
  }));
}

export interface AuthenticatedRanges {
  doc: Document;
  ranges: ReadonlyMap<string, readonly Range[]>;
  byPath: ReadonlyMap<string, Range>;
}

/**
 * Authenticate every pair and its physical parent before exposing any range.
 * A component page's root region spans the body's content, and every marked
 * range nests in it.
 */
export function authenticateDocumentRanges(
  doc: Document,
  records: readonly DocumentRange[],
): AuthenticatedRanges | undefined {
  const walker = doc.createTreeWalker(doc, 128);
  const stack: { id: string; node: Node }[] = [];
  const ranges = new Map<string, Range[]>();
  const byPath = new Map<string, Range>();
  const lookup = new Map(records.map((record) => [record.id, record]));
  const root = records[0]?.root ? records[0].id : undefined;
  let next = 0;
  if (root) {
    const range = doc.createRange();
    range.selectNodeContents(doc.body);
    byPath.set(root, range);
    next = 1;
  }
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const match = MARKER.exec(node.textContent ?? "");
    if (!match) continue;
    const [, kind, edge, number, attributes = ""] = match;
    const record = number === undefined ? undefined : lookup.get(`r-${number}`);
    if (
      !edge ||
      !record ||
      record.root ||
      (kind === "instance") !== (record.key !== undefined)
    )
      return;
    if (edge === "start") {
      if (
        records[next++]?.id !== record.id ||
        record.parentId !== (stack.at(-1)?.id ?? root) ||
        (record.key !== undefined &&
          !attributes.includes(` instance="${record.key}"`))
      )
        return;
      stack.push({ id: record.id, node });
    } else {
      const start = stack.pop();
      if (attributes || start?.id !== record.id) return;
      const range = doc.createRange();
      range.setStartAfter(start.node);
      range.setEndBefore(node);
      byPath.set(record.id, range);
      if (record.key)
        ranges.set(record.key, [...(ranges.get(record.key) ?? []), range]);
    }
  }
  if (stack.length || next !== records.length) return;
  return { doc, ranges, byPath };
}
