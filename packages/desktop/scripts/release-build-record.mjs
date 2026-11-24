import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { isReleaseAsset, releaseArtifacts } from "./release-assets.mjs";

/** @typedef {import("./release-assets.mjs").BuildAsset} BuildAsset */
/** @typedef {import("./release-assets.mjs").BuildRecord} BuildRecord */
/** @typedef {import("./release-assets.mjs").ReleasePlatform} ReleasePlatform */

export const buildRecordFilename = "desktop-build-record.json";

/** @param {string} directory @returns {Promise<(BuildAsset & {file: string})[]>} */
export async function buildArtifacts(directory) {
  const assets = [];
  for (const artifact of await releaseArtifacts(directory)) {
    const hash = createHash("sha256");
    for await (const data of createReadStream(artifact.file)) hash.update(data);
    assets.push({ ...artifact, sha256: hash.digest("hex") });
  }
  return assets;
}

/** @param {string} directory @param {BuildRecord} record */
export async function writeBuildRecord(directory, { tag, platform, assets }) {
  const record = {
    tag,
    platform,
    assets: assets.map(({ name, size, sha256 }) => ({ name, size, sha256 })),
  };
  await writeFile(
    join(directory, buildRecordFilename),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}

/** @param {unknown} asset @returns {asset is BuildAsset} */
function isBuildAsset(asset) {
  return (
    isReleaseAsset(asset) &&
    "sha256" in asset &&
    typeof asset.sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(asset.sha256)
  );
}

/** @param {string} file @returns {Promise<BuildRecord | null>} */
export async function readBuildRecord(file) {
  const text = await readFile(file, "utf8");
  /** @type {unknown} */
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    record === null ||
    typeof record !== "object" ||
    !("tag" in record) ||
    typeof record.tag !== "string" ||
    !("platform" in record) ||
    (record.platform !== "macos" && record.platform !== "linux") ||
    !("assets" in record) ||
    !Array.isArray(record.assets) ||
    !record.assets.every(isBuildAsset)
  )
    return null;
  const { tag, platform, assets } = record;
  return {
    tag,
    platform,
    assets: assets.map(({ name, size, sha256 }) => ({ name, size, sha256 })),
  };
}

/**
 * @param {string | undefined} directory
 * @param {ReleasePlatform} platform
 * @param {string | undefined} currentAttempt
 */
export async function readEarlierBuildRecords(
  directory,
  platform,
  currentAttempt,
) {
  if (!directory) return [];
  const files = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  // The download also contains the current attempt's artifact in its own directory.
  const currentArtifact = currentAttempt
    ? `desktop-build-record-${platform}-${currentAttempt}`
    : undefined;
  const records = await Promise.all(
    files
      .filter(
        (file) =>
          file.isFile() &&
          file.name === buildRecordFilename &&
          basename(file.parentPath) !== currentArtifact,
      )
      .map((file) => readBuildRecord(join(file.parentPath, file.name))),
  );
  return records.flatMap((record) =>
    record?.platform === platform ? [record] : [],
  );
}
