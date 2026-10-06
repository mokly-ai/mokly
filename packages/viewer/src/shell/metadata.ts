import type { BeforePath, CurrentPath } from "../catalogue/path_types.js";
import type { ManifestV8 } from "../registry/types.js";
import type { ReviewResultV5 } from "../review/component_types.js";
import type { ScreenResourceEvidence, ViewReview } from "../review/types.js";

export type CatalogueMetadata<Path extends string = CurrentPath> =
  | ManifestV8<Path>
  | {
      schemaVersion: "live-index-1";
      entries: ManifestV8<Path>["entries"];
      folders: ManifestV8["folders"];
      generatedBy: "mokly";
      sourceFiles: readonly string[];
    };
export interface RemovedEntrySnapshot<
  Path extends string = CurrentPath,
  Reference extends string = BeforePath<Path>,
> {
  entry: ManifestV8<Path, Reference>["entries"][number];
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
export interface ShellEvidence<Path extends string = CurrentPath> {
  baseline: ManifestV8<BeforePath<Path>>;
  /** Actual material/metadata changes, independent of pure-move membership. */
  changedEntries?: readonly Path[];
  pairing?: {
    moves: readonly {
      kind: ManifestV8["entries"][number]["kind"];
      path: Path;
      previousPath: BeforePath<Path>;
    }[];
    diagnostics: readonly string[];
  };
  result?: ReviewResultV5<Path, BeforePath<Path>>;
  screenEvidence?: readonly ScreenResourceEvidence[];
  screenViews?: readonly ScreenViewChanges[];
}
export type LiveChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable";
