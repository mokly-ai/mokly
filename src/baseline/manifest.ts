import path from "node:path";

import {
  EARLIER_MANIFEST_NAMES,
  MANIFEST_NAME,
  parseHistoricalManifest,
} from "../registry/manifest.js";
import { MAX_BATCH_OUTPUT_BYTES } from "../review/git_batch.js";

import { confinedBaselineStat } from "./confinement.js";
import type { BaselineFileSystem } from "./types.js";

/** Inspect rebuilt output while deferring the compatibility outcome to readers. */
export async function baselineManifestVersion(
  fs: BaselineFileSystem,
  root: string,
  directory: string,
  signal?: AbortSignal,
): Promise<number> {
  const prefix = path.relative(root, directory).split(path.sep).join("/");
  const relative = join(prefix, MANIFEST_NAME);
  const canonical = await confinedBaselineStat(fs, root, relative, signal);
  if (canonical === undefined) {
    for (const name of EARLIER_MANIFEST_NAMES) {
      if (
        (await confinedBaselineStat(fs, root, join(prefix, name), signal)) !==
        undefined
      )
        return 6;
    }
  }
  if (canonical?.kind !== "regular")
    throw new Error("Historical manifest is missing or is not a regular file");
  const value: unknown = JSON.parse(
    Buffer.from(
      await fs.read(path.join(root, relative), MAX_BATCH_OUTPUT_BYTES),
    ).toString("utf8"),
  );
  const version =
    value && typeof value === "object" && "schemaVersion" in value
      ? (value as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (Number.isInteger(version) && (version as number) < 8)
    return version as number;
  parseHistoricalManifest(value);
  return 8;
}

function join(prefix: string, name: string): string {
  return prefix ? `${prefix}/${name}` : name;
}
