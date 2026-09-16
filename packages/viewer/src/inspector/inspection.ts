import type { InstanceBoundary } from "../client/frame_adapter.js";

import { edges, viewport } from "./clipping.js";
import { geometry } from "./geometry.js";
import { metadataKeys, type InspectorMetadata } from "./metadata.js";
import { documentRanges } from "./ranges.js";
export const inspection = (doc: Document, metadata: InspectorMetadata) => {
  const keys = metadataKeys(metadata);
  const requireKeys = (requested: readonly string[]) => {
    if (metadata.error) throw metadata.error;
    if (requested.some((key) => !keys.includes(key))) throw "missing-instance";
  };
  return {
    __list(): readonly InstanceBoundary[] {
      const ranges = documentRanges(doc, metadata);
      const boxesFor = geometry(doc);
      let count = 0;
      return keys.map((key) => ({
        key,
        ranges: metadata.ranges.flatMap(([owner], index) => {
          if (owner !== key) return [];
          const boxes = boxesFor(ranges[index]!);
          count += boxes.length;
          if (boxes.length > 64 || count > 8192) throw "limit";
          return [{ id: `r-${index}`, boxes }];
        }),
      }));
    },
    __keys: requireKeys,
    __scroll(key: string): void {
      requireKeys([key]);
      const range = documentRanges(doc, metadata).find(
        (range, index) =>
          metadata.ranges[index]![0] === key && range.getClientRects().length,
      );
      for (
        let parent = range?.commonAncestorContainer as Element | null;
        parent?.nodeType === 1;
        parent = parent.parentElement
      ) {
        const rect = edges(range!.getClientRects()[0]!);
        const bounds =
          parent === doc.scrollingElement
            ? viewport(doc)
            : edges(parent.getBoundingClientRect());
        parent.scrollBy(
          ...([0, 1].map((axis) => {
            const start = rect[axis]! - bounds[axis]!;
            const end = rect[axis + 2]! - bounds[axis + 2]!;
            return start < 0 && end > 0
              ? 0
              : Math.min(0, start) || Math.max(0, end);
          }) as [number, number]),
        );
      }
    },
  };
};
