import type {
  HistoricalManifest,
  HistoricalManifestEntry,
  ManifestV10,
} from "../registry/types.js";
import type { ReviewResultV7 } from "../review/component_types.js";
import type {
  ScreenResourceEvidence,
  PageResourceEvidence,
  ReviewArtifact,
  ViewReview,
} from "../review/types.js";

export type CatalogueMetadata =
  | ManifestV10
  | {
      schemaVersion: "live-index-2";
      entries: ManifestV10["entries"];
      folders: ManifestV10["folders"];
      generatedBy: "mokly";
      sourceFiles: readonly string[];
    };
export interface RemovedEntrySnapshot {
  entry: HistoricalManifestEntry | ManifestV10["entries"][number];
  folderTitles: readonly string[];
  /** Baseline parent title, present exactly for a removed variant. */
  parentTitle?: string;
  snapshotId?: string;
}
/**
 * Per-view classification a screen-only catalogue records without generating
 * comparisons. Mirrors the server's own snapshot shape so the shell can read
 * it without depending on the build.
 */
export interface ScreenViewChanges {
  path: string;
  views: readonly Pick<ViewReview, "colorScheme" | "state" | "viewport">[];
}
export interface ShellEvidence {
  baseline: HistoricalManifest;
  /** Actual material/metadata changes, independent of pure-move membership. */
  changedEntries?: readonly string[];
  pairing?: NonNullable<ReviewArtifact["pairing"]>;
  result?: ReviewResultV7;
  screenEvidence?: readonly ScreenResourceEvidence[];
  pageEvidence?: readonly PageResourceEvidence[];
  screenViews?: readonly ScreenViewChanges[];
}
export type LiveChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable";
