import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  isReleaseAsset,
  releaseInventory,
  releaseManifestFilename,
} from "./release-assets.mjs";
import { githubClient, isReleaseId } from "./release-github.mjs";

/** @typedef {Omit<import("./release-assets.mjs").ReleaseManifest, "assets"> & {assets: import("./release-assets.mjs").ReleaseAsset[]}} PromotionManifest */
/** @typedef {Pick<ReturnType<typeof githubClient>, "release" | "assets" | "promote" | "latest">} PromotionClient */

const expectedManifests = "Expected one macOS manifest and one Linux manifest.";
const latestMarkAdvice =
  "The release can already be a full release. Rerun the promote job to check the latest mark.";

/** @param {unknown} error */
function message(error) {
  const text = error instanceof Error ? error.message.trimEnd() : "";
  if (!text) return "Desktop release check failed.";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** @param {unknown} error */
function beforePublicationFailure(error) {
  return new Error(
    `${message(error)} The promotion did not change the release.`,
    { cause: error },
  );
}

/** @param {string} tag @returns {[bigint, bigint, bigint]} */
function releaseVersion(tag) {
  const parts = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  if (!parts || parts[0] !== tag)
    throw new Error(
      `Invalid desktop release tag ${JSON.stringify(tag)}. Expected vMAJOR.MINOR.PATCH.`,
    );
  return [BigInt(parts[1]), BigInt(parts[2]), BigInt(parts[3])];
}

/** @param {bigint[]} candidate @param {bigint[]} current */
function higherVersion(candidate, current) {
  for (const [index, part] of candidate.entries()) {
    if (part !== current[index]) return part > current[index];
  }
  return false;
}

/** @param {string} tag @param {string} latestTag @param {boolean} draft */
function newerReleaseWarning(tag, latestTag, draft) {
  return `GitHub's latest release ${latestTag} is newer than ${tag}. Release ${tag} stays ${draft ? "a draft" : "a full release"}.`;
}

/** @param {PromotionClient} github @param {string} tag */
async function checkLatestBeforePublication(github, tag) {
  const version = releaseVersion(tag);
  const latest = await github.latest();
  if (latest && higherVersion(releaseVersion(latest.tag_name), version))
    return newerReleaseWarning(tag, latest.tag_name, true);
}

/**
 * @param {PromotionManifest[]} manifests
 * @param {PromotionClient} github
 * @param {string} tag
 */
async function checkRelease(manifests, github, tag) {
  const macos = manifests.find((manifest) => manifest.platform === "macos");
  const linux = manifests.find((manifest) => manifest.platform === "linux");
  if (manifests.length !== 2 || !macos || !linux)
    throw new Error(expectedManifests);
  if (macos.tag !== tag || linux.tag !== tag)
    throw new Error(`Both manifests must have tag ${tag}.`);
  if (macos.release !== linux.release)
    throw new Error("Manifests have different release IDs.");
  if (macos.owner !== linux.owner || macos.repo !== linux.repo)
    throw new Error("Manifests have different GitHub repositories.");

  /** @type {Map<string, number>} */
  const expected = new Map();
  for (const manifest of [macos, linux]) {
    const fixed = releaseInventory[manifest.platform];
    const names = new Set(manifest.assets.map(({ name }) => name));
    if (
      manifest.assets.length !== fixed.length ||
      fixed.some((name) => !names.has(name))
    )
      throw new Error(
        `The ${manifest.platform} manifest has the wrong asset names.`,
      );
    for (const { name, size } of manifest.assets) expected.set(name, size);
  }

  const id = macos.release;
  const release = await github.release(id);
  if (release.tag_name !== tag)
    throw new Error(`GitHub release ${id} has the wrong tag. Expected ${tag}.`);

  const assets = await github.assets(id);
  const remote = new Map(assets.map((asset) => [asset.name, asset]));
  if (assets.length !== expected.size || remote.size !== expected.size)
    throw new Error("GitHub assets do not match the complete inventory.");
  for (const [name, size] of expected) {
    const asset = remote.get(name);
    if (!asset) throw new Error(`GitHub is missing the asset ${name}.`);
    if (asset.size !== size)
      throw new Error(
        `GitHub asset ${name} has size ${asset.size}, expected ${size}.`,
      );
    if (asset.state !== "uploaded")
      throw new Error(`GitHub asset ${name} is not uploaded.`);
  }
  if (
    release.draft !== true &&
    !(release.draft === false && release.prerelease === false)
  )
    throw new Error(
      `GitHub release ${id} is a pre-release or has invalid release flags.`,
    );
  return { id, draft: release.draft };
}

/**
 * Check both manifests and GitHub's inventory before updating the release.
 * @param {PromotionManifest[]} manifests
 * @param {PromotionClient} github
 * @param {string} tag
 */
export async function promoteRelease(manifests, github, tag) {
  const { id, draft } = await checkRelease(manifests, github, tag).catch(
    (error) => {
      throw beforePublicationFailure(error);
    },
  );
  if (draft) {
    const warning = await checkLatestBeforePublication(github, tag).catch(
      (error) => {
        throw beforePublicationFailure(error);
      },
    );
    if (warning) return warning;
  }
  let latest;
  try {
    if (draft) await github.promote(id);
    latest = await github.latest();
    if (
      !draft &&
      latest &&
      latest.id !== id &&
      higherVersion(releaseVersion(latest.tag_name), releaseVersion(tag))
    )
      return newerReleaseWarning(tag, latest.tag_name, false);
  } catch (error) {
    throw new Error(
      `${message(error)} Could not verify that ${tag} is GitHub's latest release. ${latestMarkAdvice}`,
      { cause: error },
    );
  }
  if (!latest)
    throw new Error(
      `GitHub has no latest release for ${tag}. ${latestMarkAdvice}`,
    );
  if (latest.id !== id)
    throw new Error(
      `${tag} is not GitHub's latest release. GitHub returned release ${latest.id} as latest, expected ${id}. ${latestMarkAdvice}`,
    );
}

/**
 * @param {string} file
 * @returns {Promise<unknown>}
 */
async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new Error(`Could not read JSON from ${file}.`);
  }
}

/**
 * @param {unknown} value
 * @returns {value is PromotionManifest}
 */
function isReleaseManifest(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    "owner" in value &&
    typeof value.owner === "string" &&
    value.owner.length > 0 &&
    "repo" in value &&
    typeof value.repo === "string" &&
    value.repo.length > 0 &&
    "tag" in value &&
    typeof value.tag === "string" &&
    "release" in value &&
    isReleaseId(value.release) &&
    "platform" in value &&
    (value.platform === "macos" || value.platform === "linux") &&
    "assets" in value &&
    Array.isArray(value.assets) &&
    value.assets.every(isReleaseAsset)
  );
}

/** @param {string | undefined} directory @param {string | undefined} token */
async function promotionInputs(directory, token) {
  if (!directory)
    throw new Error("Provide the directory with the release manifests.");
  if (!token)
    throw new Error("GH_TOKEN is required to check the desktop release.");
  const files = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  }).catch(() => {
    throw new Error(`Could not list release manifests in ${directory}.`);
  });
  const manifests = await Promise.all(
    files
      .filter((file) => file.isFile() && file.name === releaseManifestFilename)
      .map(async (file) => {
        const path = join(file.parentPath, file.name);
        const manifest = await readJson(path);
        if (!isReleaseManifest(manifest))
          throw new Error(`Invalid desktop release manifest at ${path}.`);
        return manifest;
      }),
  );
  const [first] = manifests;
  if (!first) throw new Error(expectedManifests);
  const pkg = await readJson(join(import.meta.dirname, "../package.json"));
  if (
    pkg === null ||
    typeof pkg !== "object" ||
    !("version" in pkg) ||
    typeof pkg.version !== "string"
  )
    throw new Error("Desktop package version is missing.");
  return {
    manifests,
    github: githubClient(first, token),
    tag: `v${pkg.version}`,
  };
}

if (import.meta.main) {
  try {
    const { manifests, github, tag } = await promotionInputs(
      process.argv[2],
      process.env.GH_TOKEN,
    ).catch((error) => {
      throw beforePublicationFailure(error);
    });
    const warning = await promoteRelease(manifests, github, tag);
    if (warning) console.log(`::warning::${warning}`);
    else console.log(`Desktop release ${tag} is latest.`);
  } catch (error) {
    console.error(message(error));
    process.exitCode = 1;
  }
}
