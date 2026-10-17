import type {
  HistoricalManifest,
  HistoricalManifestEntry,
  ManifestV10,
} from "../registry/types.js";
import type {
  EvidenceReasons,
  ReviewResult,
  ReviewView,
  ViewResourceEvidence,
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
  views: readonly Pick<ReviewView, "colorScheme" | "state" | "viewport">[];
}
export interface ShellEvidence {
  baseline: HistoricalManifest;
  /** Actual material/metadata changes, independent of pure-move membership. */
  changedEntries?: readonly string[];
  result?: ReviewResult;
  screenEvidence?: readonly {
    path: string;
    views: readonly ViewResourceEvidence[];
  }[];
  pageEvidence?: readonly (EvidenceReasons & { path: string })[];
  screenViews?: readonly ScreenViewChanges[];
}
export type LiveChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable";
