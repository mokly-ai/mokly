import type { CatalogueUsage } from "../catalogue/types.js";
import {
  readMetadata,
  metadataKeys,
  unavailableMetadata,
  compactRanges,
  type InspectorMetadata,
} from "../inspector/metadata.js";
import { BYTE_LIMIT, EVENTS } from "../inspector/values.js";
import type { InspectorEventType } from "../inspector/values.js";

import type { InstanceBoundary } from "./frame_adapter.js";
import { FrameError } from "./frame_error.js";

/** Snapshot only the instance/range identities needed by the mounted session. */
export function frameUsage(usage: CatalogueUsage): InspectorMetadata {
  if (usage.status !== "ready") return unavailableMetadata("unavailable");
  if (usage.instances.length > 1024 || usage.ranges.length > 4096)
    return unavailableMetadata("limit");
  const ranges = compactRanges(usage.ranges);
  if (!ranges) throw new FrameError("invalid-boundary");
  const json = JSON.stringify({
    ranges,
    links: [],
  });
  if (new TextEncoder().encode(json).length > BYTE_LIMIT)
    return unavailableMetadata("limit");
  const metadata = readMetadata(json);
  if (!metadata) throw new FrameError("invalid-boundary");
  const expected = usage.instances.map((instance) => instance.key).sort();
  if (metadataKeys(metadata).join() !== expected.join())
    throw new FrameError("invalid-boundary");
  return metadata;
}
export function knownKey(usage: InspectorMetadata, key: string): boolean {
  return !usage.error && metadataKeys(usage).includes(key);
}
/** Navigation is independent of inspection evidence and its bounded identities. */
export function frameEvents(
  usage: InspectorMetadata,
): readonly InspectorEventType[] {
  return usage.error ? ["navigation"] : EVENTS;
}
export function validateBoundaryUsage(
  boundaries: readonly InstanceBoundary[],
  usage: InspectorMetadata,
): boolean {
  const keys = metadataKeys(usage);
  if (usage.error || boundaries.length !== keys.length) return false;
  return boundaries.every((boundary, index) => {
    const expected = usage.ranges.flatMap(([key], index) =>
      key === boundary.key ? [`r-${index}`] : [],
    );
    return (
      boundary.key === keys[index] &&
      boundary.ranges.length === expected.length &&
      boundary.ranges.every(
        (range, position) => range.id === expected[position],
      )
    );
  });
}
