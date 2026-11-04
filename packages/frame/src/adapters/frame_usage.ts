import type { CatalogueUsage } from "@mokly/model";

import type { InstanceBoundary } from "../frame_adapter.js";
import {
  readMetadata,
  metadataKeys,
  unavailableMetadata,
  compactRanges,
  type ProbeMetadata,
} from "../probe/metadata.js";
import { BYTE_LIMIT, EVENTS, type ProbeEventType } from "../probe/values.js";

import { FrameError } from "./frame_error.js";

/** Snapshot only the instance/range identities needed by the mounted session. */
export function frameUsage(usage: CatalogueUsage): ProbeMetadata {
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
export function knownKey(usage: ProbeMetadata, key: string): boolean {
  return !usage.error && metadataKeys(usage).includes(key);
}
/** Navigation is independent of inspection evidence and its bounded identities. */
export function frameEvents(usage: ProbeMetadata): readonly ProbeEventType[] {
  return usage.error ? ["navigation"] : EVENTS;
}
export function validateBoundaryUsage(
  boundaries: readonly InstanceBoundary[],
  usage: ProbeMetadata,
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
