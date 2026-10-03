import type {
  HistoricalManifest,
  HistoricalManifestEntry,
  ManifestV8,
} from "../registry/types.js";
import type { ReviewResultV5 } from "../review/component_types.js";
import type {
  ScreenResourceEvidence,
  PageResourceEvidence,
  ViewReview,
} from "../review/types.js";

export type CatalogueMetadata =
  | ManifestV8
  | {
      schemaVersion: "live-index-1";
      entries: ManifestV8["entries"];
      generatedBy: "mokly";
      sourceFiles: readonly string[];
    };
export interface RemovedEntrySnapshot {
  entry: HistoricalManifestEntry | ManifestV8["entries"][number];
  snapshotId?: string;
}
/**
 * Per-view classification a screen-only catalogue records without generating
 * comparisons. Mirrors the server's own snapshot shape so the shell can read
 * it without depending on the build.
 */
export interface ScreenViewChanges {
  id: string;
  views: readonly Pick<ViewReview, "colorScheme" | "state" | "viewport">[];
}
export interface ShellEvidence {
  baseline: HistoricalManifest;
  result?: ReviewResultV5;
  screenEvidence?: readonly ScreenResourceEvidence[];
  pageEvidence?: readonly PageResourceEvidence[];
  screenViews?: readonly ScreenViewChanges[];
}
export type LiveChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable";
