import type { FrameNavigation } from "../client/frame_adapter.js";
import type { ComponentRangeRecord } from "../components/manifest_types.js";

import { array, boundedJson, identity, key, object, shape } from "./values.js";
/** Range index n is r-n; null keys identify slots and null parents identify roots. */
export type InspectorRange = readonly [
  key: string | null,
  parent: number | null,
];
export type LinkIdentity = Omit<FrameNavigation, "activation">;
export interface InspectorMetadata {
  ranges: readonly InspectorRange[];
  links: readonly LinkIdentity[];
  error?: "limit" | "unavailable";
}
export const metadataKeys = (metadata: InspectorMetadata): string[] =>
  [...new Set(metadata.ranges.flatMap(([key]) => key ?? []))].sort();
export const unavailableMetadata = (
  error: "limit" | "unavailable",
): InspectorMetadata => ({ ranges: [], links: [], error });
/** Validate references before conversion, which must never coerce a bad parent to null. */
export const compactRanges = (
  records: readonly ComponentRangeRecord[],
): InspectorRange[] | undefined => {
  if (
    records.some(
      (record, index) =>
        record.id !== `r-${index}` ||
        (record.parentId !== undefined &&
          !records
            .slice(0, index)
            .some((parent) => parent.id === record.parentId)),
    )
  )
    return;
  return records.map((record) => [
    record.target.kind === "instance" ? record.target.instanceKey : null,
    record.parentId === undefined ? null : Number(record.parentId.slice(2)),
  ]);
};
/** Compact inert tuples retain every identity and physical parent without duplication. */
export const readMetadata = (json: unknown): InspectorMetadata | undefined => {
  const value = boundedJson(json);
  if (
    !object(value) ||
    !shape(value, 2 + Number(value.error !== undefined)) ||
    !([undefined, "limit", "unavailable"] as readonly unknown[]).includes(
      value.error,
    ) ||
    !array(value.ranges, 4096) ||
    !array(value.links, 1024) ||
    !value.ranges.every(
      (range, index) =>
        array(range, 2) &&
        range.length === 2 &&
        (range[0] === null || key(range[0])) &&
        (range[1] === null ||
          (Number.isInteger(range[1]) &&
            (range[1] as number) >= 0 &&
            (range[1] as number) < index)),
    ) ||
    !value.links.every(
      (link) =>
        object(link) &&
        shape(link, 2 + Number(link.fragment !== undefined)) &&
        identity(link),
    )
  )
    return;
  const metadata = value as unknown as InspectorMetadata;
  return metadataKeys(metadata).length <= 1024 ? metadata : undefined;
};
