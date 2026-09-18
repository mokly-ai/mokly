import type { Manifest, ManifestEntry, ManifestV5 } from "../registry/types.js";
import type { ReviewResultV3 } from "../review/component_types.js";
import type { ScreenResourceEvidence } from "../review/types.js";

export type CatalogueMetadata =
  | Manifest
  | {
      schemaVersion: "live-index-1";
      entries: ManifestV5["entries"];
      generatedBy: "mokly";
      sourceFiles: readonly string[];
    };
export interface RemovedEntrySnapshot {
  entry: Exclude<ManifestEntry, { kind: "collection" }>;
  ancestors: readonly { id: string; title: string }[];
}
export interface ShellEvidence {
  baseline: Manifest;
  result?: ReviewResultV3;
  screenEvidence?: readonly ScreenResourceEvidence[];
}
export type LiveChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable";
