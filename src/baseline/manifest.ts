import path from "node:path";

import {
  FORMER_MANIFEST_NAME,
  MANIFEST_NAME,
  parseHistoricalManifest,
  selectManifestInput,
} from "../registry/manifest.js";
import { MAX_BATCH_OUTPUT_BYTES } from "../review/git_batch.js";

import { confinedBaselineStat } from "./confinement.js";
import type { BaselineFileSystem } from "./types.js";

/** Validate the historical schema while retaining its original on-disk version. */
export async function baselineManifestVersion(
  fs: BaselineFileSystem,
  root: string,
  directory: string,
  allowV2 = false,
  signal?: AbortSignal,
): Promise<2 | 3 | 4 | 5 | 6> {
  const prefix = path.relative(root, directory).split(path.sep).join("/");
  const canonical = await confinedBaselineStat(
    fs,
    root,
    `${prefix}/${MANIFEST_NAME}`,
    signal,
  );
  const former = await confinedBaselineStat(
    fs,
    root,
    `${prefix}/${FORMER_MANIFEST_NAME}`,
    signal,
  );
  const selection = selectManifestInput(
    canonical !== undefined,
    former !== undefined,
    allowV2,
  );
  const relative = `${prefix}/${selection.filename}`;
  const stat = await confinedBaselineStat(fs, root, relative, signal);
  if (stat?.kind !== "regular")
    throw new Error("Historical manifest is missing or is not a regular file");
  const value: unknown = JSON.parse(
    Buffer.from(
      await fs.read(path.join(root, relative), MAX_BATCH_OUTPUT_BYTES),
    ).toString("utf8"),
  );
  parseHistoricalManifest(value, selection.allowV2);
  return (value as { schemaVersion: 2 | 3 | 4 | 5 | 6 }).schemaVersion;
}
