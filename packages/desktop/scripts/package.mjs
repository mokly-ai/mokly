import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  publishRelease,
  releaseFileNames,
  releaseInventory,
  writeReleaseManifest,
} from "./release-assets.mjs";
import {
  buildArtifacts,
  buildRecordFilename,
  readBuildRecord,
  readEarlierBuildRecords,
  writeBuildRecord,
} from "./release-build-record.mjs";
import { githubClient } from "./release-github.mjs";

const desktop = resolve(import.meta.dirname, "..");
/** @typedef {import("./release-assets.mjs").ReleasePlatform} ReleasePlatform */

/**
 * Check all the release files that the preview build produced for this platform.
 * @param {string[]} names
 * @param {NodeJS.Platform} platform
 */
export function platformInventory(names, platform) {
  const expected = releaseInventory[platform === "darwin" ? "macos" : "linux"];
  const files = releaseFileNames(names);
  const missing = expected.filter((name) => !files.includes(name));
  const extra = files.filter((name) => !expected.includes(name));
  const problems = [];
  if (missing.length > 0)
    problems.push(`Missing release files are ${missing.sort().join(", ")}.`);
  if (extra.length > 0)
    problems.push(`Extra release files are ${extra.sort().join(", ")}.`);
  if (problems.length > 0) throw new Error(problems.join(" "));
  return files;
}

/**
 * Find the fixed launch artifact in the verified preview output.
 * @param {string[]} names
 * @param {NodeJS.Platform} platform
 */
export function packageArtifact(names, platform) {
  const launchName =
    platform === "darwin"
      ? "Mokly-mac-arm64.zip"
      : "Mokly-linux-x86_64.AppImage";
  return platformInventory(names, platform).find((name) => name === launchName);
}

/** Keep preview packaging credential-free while retaining a runnable arm64 app. */
export function packageArguments(platform, release) {
  const args = [
    platform === "darwin" ? "--mac" : "--linux",
    "--publish",
    "never",
  ];
  if (platform === "darwin") {
    args.push("--arm64", "--x64");
    if (release) args.push("--config.forceCodeSigning=true");
    else
      args.push(
        "--config.mac.identity=-",
        "--config.mac.hardenedRuntime=false",
        "--config.mac.notarize=false",
      );
  } else args.push("--x64");
  return args;
}

/**
 * Only electron-builder sees credential paths and passwords; files are private.
 * @template Result
 * @param {Record<string, string>} environment
 * @param {(environment: Record<string, string>) => Result | Promise<Result>} callback
 */
export async function withSigningFiles(environment, callback) {
  const directory = await mkdtemp(join(tmpdir(), "mokly-signing-"));
  try {
    const certificate = join(directory, "developer-id.p12");
    const key = join(directory, "AuthKey.p8");
    await writeFile(certificate, Buffer.from(environment.CSC_LINK, "base64"), {
      mode: 0o600,
    });
    await writeFile(key, environment.APPLE_API_KEY, { mode: 0o600 });
    return await callback({
      ...environment,
      CSC_LINK: certificate,
      APPLE_API_KEY: key,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** @param {string} directory @param {boolean} release @param {NodeJS.ProcessEnv} env */
function buildPackages(directory, release, env) {
  const result = spawnSync(
    resolve(desktop, "../../node_modules/.bin/electron-builder"),
    [
      ...packageArguments(process.platform, release),
      `--config.directories.output=${directory}`,
    ],
    { cwd: desktop, env, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function releaseTag() {
  /** @type {unknown} */
  const pkg = JSON.parse(await readFile(join(desktop, "package.json"), "utf8"));
  if (
    pkg === null ||
    typeof pkg !== "object" ||
    !("version" in pkg) ||
    typeof pkg.version !== "string"
  )
    throw new Error("Desktop package version is missing.");
  return `v${pkg.version}`;
}

/** @param {string} output @param {string} directory @param {ReleasePlatform} platform */
async function releaseBuild(output, directory, platform) {
  await rm(directory, { recursive: true, force: true });
  await rm(join(output, buildRecordFilename), { force: true });
  await mkdir(directory, { recursive: true });
  const environment = { ...process.env };
  const status =
    platform === "macos"
      ? await withSigningFiles(environment, (env) =>
          buildPackages(directory, true, env),
        )
      : buildPackages(directory, true, environment);
  if (status !== 0) return status;

  await writeBuildRecord(output, {
    tag: await releaseTag(),
    platform,
    assets: await buildArtifacts(directory),
  });
  return 0;
}

/**
 * @param {string} output
 * @param {string} directory
 * @param {ReleasePlatform} platform
 * @param {string | undefined} records
 */
async function releasePublish(output, directory, platform, records) {
  try {
    const token = process.env.GH_TOKEN;
    if (!token)
      throw new Error("GH_TOKEN is required to publish desktop packages.");
    const tag = await releaseTag();
    const record = await readBuildRecord(join(output, buildRecordFilename));
    if (!record || record.tag !== tag || record.platform !== platform)
      throw new Error(`The build record must match ${platform} ${tag}.`);
    const artifacts = await buildArtifacts(directory);
    const recorded = new Map(record.assets.map((asset) => [asset.name, asset]));
    if (
      artifacts.length !== record.assets.length ||
      artifacts.some(({ name, size, sha256 }) => {
        const asset = recorded.get(name);
        return asset?.size !== size || asset.sha256 !== sha256;
      })
    )
      throw new Error(
        "The kept desktop build does not match its build record.",
      );

    const { parse } = await import("yaml");
    const { AppendOnlyPublisher } = await import("./release-publisher.mjs");
    const { publish } = parse(
      await readFile(join(desktop, "electron-builder.yml"), "utf8"),
    );
    const github = githubClient(publish, token);
    const publisher = new AppendOnlyPublisher(
      { ...publish, token },
      tag.slice(1),
      github,
    );
    const manifest = await publishRelease(
      artifacts,
      publisher,
      github,
      { owner: publish.owner, repo: publish.repo, tag, platform },
      () =>
        readEarlierBuildRecords(
          records,
          platform,
          process.env.GITHUB_RUN_ATTEMPT,
        ),
    );
    await writeReleaseManifest(output, manifest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const mode = process.argv[2];
  const output = join(desktop, "release");
  const directory = join(output, "build");
  const platform = process.platform === "darwin" ? "macos" : "linux";
  if (mode === "release-build") {
    process.exitCode = await releaseBuild(output, directory, platform);
  } else if (mode === "release-publish") {
    await releasePublish(output, directory, platform, process.argv[3]);
  } else if (mode === undefined || mode === "preview") {
    await mkdir(output, { recursive: true });
    process.exitCode = buildPackages(output, false, {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
    });
  } else {
    throw new Error("Use preview, release-build or release-publish.");
  }
}
