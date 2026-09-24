import type { Manifest, ManifestEntry, ManifestV6 } from "../registry/types.js";
import type { ReviewResultV3 } from "../review/component_types.js";
import type { ScreenResourceEvidence, ViewReview } from "../review/types.js";

export type CatalogueMetadata =
  | Manifest
  | {
      schemaVersion: "live-index-1";
      entries: ManifestV6["entries"];
      generatedBy: "mokly";
      sourceFiles: readonly string[];
    };
export interface RemovedEntrySnapshot {
  entry: Exclude<ManifestEntry, { kind: "collection" }>;
  ancestors: readonly { id: string; title: string }[];
}
/**
 * Per-view classification a screen-only catalogue records without generating
 * comparisons. Mirrors the server's own snapshot shape so the shell can read
 * it without depending on the build.
 */
export interface ScreenViewChanges {
  route: string;
  views: readonly Pick<ViewReview, "colorScheme" | "state" | "viewport">[];
}
export interface ShellEvidence {
  baseline: Manifest;
  result?: ReviewResultV3;
  screenEvidence?: readonly ScreenResourceEvidence[];
  screenViews?: readonly ScreenViewChanges[];
}
export type LiveChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable";
