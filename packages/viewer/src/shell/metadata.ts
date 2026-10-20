import type {
  HistoricalManifestEntry,
  ManifestV10,
} from "../registry/types.js";

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
export type LiveChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable";
