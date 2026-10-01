import type {
  HistoricalManifest,
  HistoricalManifestEntry,
  ManifestV7,
} from "../registry/types.js";
import type { ReviewResultV4 } from "../review/component_types.js";
import type { ScreenResourceEvidence, ViewReview } from "../review/types.js";

/** One private live-index entry with resolved Live-preview eligibility. */
export type CatalogueIndexEntry =
  | (Extract<
      ManifestV7["entries"][number],
      { kind: "component" | "screen" }
    > & { interactive: boolean })
  | Exclude<ManifestV7["entries"][number], { kind: "component" | "screen" }>;

export type CatalogueMetadata =
  | ManifestV7
  | {
      schemaVersion: "live-index-1";
      entries: readonly CatalogueIndexEntry[];
      generatedBy: "mokly";
      sourceFiles: readonly string[];
    };
export interface RemovedEntrySnapshot {
  entry: HistoricalManifestEntry | ManifestV7["entries"][number];
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
  result?: ReviewResultV4;
  screenEvidence?: readonly ScreenResourceEvidence[];
  screenViews?: readonly ScreenViewChanges[];
}
export type LiveChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable";
