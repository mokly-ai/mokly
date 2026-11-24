import { readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** @typedef {{name: string, size: number}} ReleaseAsset */
/** @typedef {ReleaseAsset & {sha256: string}} BuildAsset */
/** @typedef {ReleaseAsset & {state: string, digest?: string}} GitHubAsset */
/** @typedef {"macos" | "linux"} ReleasePlatform */
/** @typedef {{tag: string, platform: ReleasePlatform, assets: BuildAsset[]}} BuildRecord */
/** @typedef {BuildRecord & {owner: string, repo: string, release: number}} ReleaseManifest */

export const releaseManifestFilename = "desktop-release-manifest.json";

export const releaseInventory = {
  macos: [
    "Mokly-mac-arm64.dmg",
    "Mokly-mac-x64.dmg",
    "Mokly-mac-arm64.zip",
    "Mokly-mac-x64.zip",
    "Mokly-mac-arm64.dmg.blockmap",
    "Mokly-mac-x64.dmg.blockmap",
    "Mokly-mac-arm64.zip.blockmap",
    "Mokly-mac-x64.zip.blockmap",
    "latest-mac.yml",
  ],
  linux: [
    "Mokly-linux-x86_64.AppImage",
    "Mokly-linux-amd64.deb",
    "latest-linux.yml",
  ],
};

/**
 * Save the platform's verified inventory for the promotion job.
 * @param {string} directory
 * @param {ReleaseManifest} manifest
 */
export async function writeReleaseManifest(
  directory,
  { owner, repo, tag, release, platform, assets },
) {
  const manifest = { owner, repo, tag, release, platform, assets };
  await writeFile(
    join(directory, releaseManifestFilename),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

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

/** @param {string[]} names */
export function releaseFileNames(names) {
  return names.filter((name) =>
    /\.(dmg|zip|AppImage|deb|blockmap)$|^latest(?:-.+)?\.yml$/.test(name),
  );
}

/**
 * Inventory only this build's packages and updater files, excluding builder logs.
 * @param {string} directory
 * @param {{readdir: (directory: string) => Promise<string[]>, stat: (file: string) => Promise<{size: number, isFile: () => boolean}>}} io
 */
export async function releaseArtifacts(directory, io = { readdir, stat }) {
  const names = releaseFileNames(await io.readdir(directory));
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
 * @param {BuildRecord} record
 * @param {Pick<BuildRecord, "tag" | "platform">} identity
 * @param {Map<string, GitHubAsset>} existing
 */
function matchesEarlierBuild(record, { tag, platform }, existing) {
  return (
    record.tag === tag &&
    record.platform === platform &&
    record.assets.length === existing.size &&
    new Set(record.assets.map(({ name }) => name)).size === existing.size &&
    record.assets.every(({ name, size, sha256 }) => {
      const asset = existing.get(name);
      return (
        asset?.size === size &&
        asset.state === "uploaded" &&
        asset.digest === `sha256:${sha256}`
      );
    })
  );
}

/**
 * Check the publisher's receipts and GitHub's final inventory. Record the
 * verified draft and uploaded assets for this platform.
 * @param {(BuildAsset & {file: string})[]} artifacts
 * @param {{_release: {value: Promise<{id: number} | null>}, uploaded: Set<string>, upload: (task: {file: string, arch: null}) => Promise<unknown>}} publisher
 * @param {{release: (id: number) => Promise<{id: number, draft: boolean, tag_name: string}>, assets: (id: number) => Promise<GitHubAsset[]>}} github
 * @param {Omit<ReleaseManifest, "release" | "assets">} identity
 * @param {() => Promise<BuildRecord[]>} readEarlierRecords
 * @returns {Promise<ReleaseManifest>}
 */
export async function publishRelease(
  artifacts,
  publisher,
  github,
  identity,
  readEarlierRecords = async () => [],
) {
  const { owner, repo, tag, platform } = identity;
  const release = await publisher._release.value;
  if (release === null)
    throw releaseFailure("The pinned publisher skipped the release");
  const existing = await github.assets(release.id);
  const fixed = releaseInventory[platform];
  const existingPlatformAssets = existing.filter(({ name }) =>
    fixed.includes(name),
  );

  /** @type {BuildRecord | undefined} */
  let earlier;
  if (existingPlatformAssets.length > 0) {
    const byName = new Map(
      existingPlatformAssets.map((asset) => [asset.name, asset]),
    );
    const other = releaseInventory[platform === "macos" ? "linux" : "macos"];
    if (
      existingPlatformAssets.length !== fixed.length ||
      byName.size !== fixed.length ||
      existing.some(
        ({ name }) => !fixed.includes(name) && !other.includes(name),
      )
    )
      throw releaseFailure(
        `Assets already published without a complete ${platform} inventory`,
      );
    earlier = (await readEarlierRecords()).find((record) =>
      matchesEarlierBuild(record, identity, byName),
    );
    if (!earlier)
      throw releaseFailure(
        "Assets already published without a matching earlier build record",
      );
  } else {
    const collisions = artifacts.filter((file) =>
      existing.some((asset) => asset.name === file.name),
    );
    if (collisions.length > 0)
      throw releaseFailure(
        `Assets already published: ${collisions.map((file) => file.name).join(", ")}`,
      );
    for (const artifact of artifacts)
      await publisher.upload({ file: artifact.file, arch: null });
  }

  const remote = await github.release(release.id);
  if (
    remote.id !== release.id ||
    remote.draft !== true ||
    remote.tag_name !== tag
  )
    throw releaseFailure(
      `Release ${release.id} is not a draft with tag ${tag}`,
    );
  if (earlier) {
    console.log(`Reusing earlier upload for ${platform} ${tag}.`);
  } else {
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
  }
  return {
    owner,
    repo,
    tag,
    release: remote.id,
    platform,
    assets:
      earlier?.assets ??
      artifacts.map(({ name, size, sha256 }) => ({ name, size, sha256 })),
  };
}
