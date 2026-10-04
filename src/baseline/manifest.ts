import path from "node:path";

import {
  GENERATED_DIRECTORY,
  type HistoricalManifest,
} from "@mokly/viewer/data";

import {
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
  readonly version: 8;
}

export type CatalogueProbe =
  | HistoricalCatalogue
  | {
      readonly root: string;
      readonly version: number;
      readonly incompatible: true;
    };

/** Probe the generated manifest, then the root canonical name only after rebuilding. */
export async function historicalCatalogueAt(
  fs: BaselineFileSystem,
  extraction: string,
  root: string,
  commit: string,
  signal?: AbortSignal,
): Promise<CatalogueProbe | undefined> {
  const relative =
    path.relative(extraction, root).split(path.sep).join("/") || ".";
  for (const filename of [
    `${GENERATED_DIRECTORY}/${MANIFEST_NAME}`,
    MANIFEST_NAME,
  ]) {
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
    const version = manifestEnvelopeVersion(value);
    if (version < 8) return { root: relative, version, incompatible: true };
    const manifest = parseHistoricalManifest(value);
    if (filename !== `${GENERATED_DIRECTORY}/${MANIFEST_NAME}`)
      throw new Error(
        `Historical v8 manifest must be in the generated directory: ${repoPath}`,
      );
    return {
      descriptor: baselineCatalogue(commit, relative),
      manifest,
      version: 8,
    };
  }
}

function manifestEnvelopeVersion(value: unknown): number {
  const version =
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "schemaVersion" in value
      ? value.schemaVersion
      : undefined;
  if (!Number.isInteger(version))
    throw new Error("Historical manifest has no integer schema version");
  return version as number;
}
