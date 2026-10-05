import type { BeforePath } from "../catalogue/path_types.js";
import type { HistoricalManifest, ManifestV8 } from "../registry/types.js";
import type { ReviewResultV5 } from "../review/component_types.js";
import type {
  ReviewArtifact,
  ScreenResourceEvidence,
  ViewReview,
} from "../review/types.js";

export type CatalogueMetadata<Path extends string = string> =
  | ManifestV8<Path>
  | {
      schemaVersion: "live-index-1";
      entries: ManifestV8<Path>["entries"];
      folders: ManifestV8["folders"];
      generatedBy: "mokly";
      sourceFiles: readonly string[];
    };
export interface RemovedEntrySnapshot<Path extends string = string> {
  entry: ManifestV8<Path, BeforePath<Path>>["entries"][number];
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
  result?: ReviewResultV5;
  screenEvidence?: readonly ScreenResourceEvidence[];
  screenViews?: readonly ScreenViewChanges[];
}
export type LiveChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable";
