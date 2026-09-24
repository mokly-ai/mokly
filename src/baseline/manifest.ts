import path from "node:path";

import type { HistoricalManifest } from "@mokly/viewer/data";

import {
  FORMER_MANIFEST_NAME,
  LEGACY_MANIFEST_NAME,
  MANIFEST_NAME,
  parseHistoricalManifest,
} from "../registry/manifest.js";
import { MAX_BATCH_OUTPUT_BYTES } from "../review/git_batch.js";

import {
  baselineCatalogue,
  joinCataloguePath,
  type BaselineCatalogue,
} from "./catalogue.js";
import { confinedBaselineStat } from "./confinement.js";
import type { BaselineFileSystem } from "./types.js";

export interface HistoricalCatalogue {
  readonly descriptor: BaselineCatalogue;
  readonly manifest: HistoricalManifest;
  readonly version: 2 | 3 | 4 | 5 | 6;
}

/** Read the first eligible manifest at one historical root; never mask an invalid preferred file. */
export async function historicalCatalogueAt(
  fs: BaselineFileSystem,
  extraction: string,
  root: string,
  commit: string,
  allowV2: boolean,
  signal?: AbortSignal,
): Promise<HistoricalCatalogue | undefined> {
  const relative =
    path.relative(extraction, root).split(path.sep).join("/") || ".";
  const candidates: readonly (readonly [
    string,
    BaselineCatalogue["layout"],
    boolean,
  ])[] = [
    [`.generated/${MANIFEST_NAME}`, "generated-v6", false],
    [MANIFEST_NAME, "legacy", false],
    [FORMER_MANIFEST_NAME, "legacy", false],
    ...(allowV2 ? [[LEGACY_MANIFEST_NAME, "legacy", true] as const] : []),
  ];
  for (const [filename, layout, versionTwo] of candidates) {
    const repoPath = joinCataloguePath(relative, filename);
    const stat = await confinedBaselineStat(fs, extraction, repoPath, signal);
    if (!stat) continue;
    if (stat.kind !== "regular")
      throw new Error(`Historical manifest is not a regular file: ${repoPath}`);
    const value: unknown = JSON.parse(
      Buffer.from(
        await fs.read(path.join(extraction, repoPath), MAX_BATCH_OUTPUT_BYTES),
      ).toString("utf8"),
    );
    const manifest = parseHistoricalManifest(value, versionTwo);
    if (layout === "generated-v6" && manifest.schemaVersion !== 6)
      throw new Error(`Historical .generated manifest must be v6: ${repoPath}`);
    return {
      descriptor: baselineCatalogue(commit, relative, layout),
      manifest,
      version: (value as { schemaVersion: 2 | 3 | 4 | 5 | 6 }).schemaVersion,
    };
  }
}

/** Validate the historical schema while retaining its original on-disk version. */
export async function baselineManifestVersion(
  fs: BaselineFileSystem,
  root: string,
  directory: string,
  allowV2 = false,
  signal?: AbortSignal,
): Promise<2 | 3 | 4 | 5 | 6> {
  const selected = await historicalCatalogueAt(
    fs,
    root,
    directory,
    "",
    allowV2,
    signal,
  );
  if (!selected) throw new Error("Historical manifest is missing");
  return selected.version;
}
