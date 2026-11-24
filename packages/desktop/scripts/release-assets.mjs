import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/** @typedef {{name: string, size: number}} ReleaseAsset */
/** @typedef {{owner: string, repo: string, tag: string, release: number, platform: "macos" | "linux", assets: ReleaseAsset[]}} ReleaseManifest */

export const releaseManifestFilename = "desktop-release-manifest.json";

/** Every failed publish keeps existing assets and gives the same recovery path. */
export function releaseFailure(reason) {
  return new Error(
    `${reason}. Uploaded assets are never replaced or deleted. To recover from a partial upload, use a new package version.`,
  );
}

/**
 * @param {unknown} asset
 * @returns {asset is ReleaseAsset}
 */
export function isReleaseAsset(asset) {
  return (
    asset !== null &&
    typeof asset === "object" &&
    "name" in asset &&
    typeof asset.name === "string" &&
    "size" in asset &&
    typeof asset.size === "number" &&
    Number.isSafeInteger(asset.size) &&
    asset.size >= 0
  );
}

/**
 * Inventory only this build's packages and updater files, excluding builder logs.
 * @param {string} directory
 * @param {{readdir: (directory: string) => Promise<string[]>, stat: (file: string) => Promise<{size: number, isFile: () => boolean}>}} io
 */
export async function releaseArtifacts(directory, io = { readdir, stat }) {
  const names = (await io.readdir(directory)).filter((name) =>
    /\.(dmg|zip|AppImage|deb|blockmap)$|^latest(?:-.+)?\.yml$/.test(name),
  );
  const artifacts = [];
  for (const name of names.sort()) {
    const file = join(directory, name);
    const metadata = await io.stat(file);
    if (metadata.isFile()) artifacts.push({ name, file, size: metadata.size });
  }
  if (artifacts.length === 0)
    throw releaseFailure("No release artifacts built");
  return artifacts;
}

/**
 * Check both the publisher's receipts and GitHub's final inventory. A publisher
 * that resolves without uploading must never turn a partial release green.
 * @param {(ReleaseAsset & {file: string})[]} artifacts
 * @param {{_release: {value: Promise<{id: number} | null>}, uploaded: Set<string>, upload: (task: {file: string, arch: null}) => Promise<unknown>}} publisher
 * @param {{release: (id: number) => Promise<{id: number, draft: boolean, tag_name: string}>, assets: (id: number) => Promise<(ReleaseAsset & {state: string})[]>}} github
 * @param {string} tag
 * @returns {Promise<ReleaseAsset[]>}
 */
export async function publishRelease(artifacts, publisher, github, tag) {
  const release = await publisher._release.value;
  if (release === null)
    throw releaseFailure("The pinned publisher skipped the release");
  const existing = await github.assets(release.id);
  const collisions = artifacts.filter((file) =>
    existing.some((asset) => asset.name === file.name),
  );
  if (collisions.length > 0)
    throw releaseFailure(
      `Assets already published: ${collisions.map((file) => file.name).join(", ")}`,
    );

  for (const artifact of artifacts)
    await publisher.upload({ file: artifact.file, arch: null });

  const remote = await github.release(release.id);
  if (
    remote.id !== release.id ||
    remote.draft !== true ||
    remote.tag_name !== tag
  )
    throw releaseFailure(
      `Release ${release.id} is not a draft with tag ${tag}`,
    );
  const assets = await github.assets(release.id);
  const missing = artifacts.filter(
    (file) =>
      !publisher.uploaded.has(file.name) ||
      !assets.some(
        (asset) =>
          asset.name === file.name &&
          asset.size === file.size &&
          asset.state === "uploaded",
      ),
  );
  if (missing.length > 0)
    throw releaseFailure(
      `Release upload incomplete: ${missing.map((file) => file.name).join(", ")}`,
    );
  return artifacts.map(({ name, size }) => ({ name, size }));
}
