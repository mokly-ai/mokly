import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parse } from "yaml";

import {
  publishRelease,
  releaseArtifacts,
  releaseManifestFilename,
} from "./release-assets.mjs";
import { githubClient } from "./release-github.mjs";
import { AppendOnlyPublisher } from "./release-publisher.mjs";

const desktop = resolve(import.meta.dirname, "..");

/** Find the launch-smoke distributable among electron-builder's output files. */
export function packageArtifact(names, platform) {
  const suffix = platform === "darwin" ? "-mac-arm64.zip" : ".AppImage";
  return names.find((name) => name.endsWith(suffix));
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
 * @param {Record<string, string>} environment
 * @param {(environment: Record<string, string>) => unknown | Promise<unknown>} callback
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

if (import.meta.main) {
  const release = process.argv[2] === "release";
  const environment = { ...process.env };
  if (!release) environment.CSC_IDENTITY_AUTO_DISCOVERY = "false";
  // An owned output directory prevents stale files from entering the inventory.
  const output = join(desktop, "release");
  await mkdir(output, { recursive: true });
  const directory = release ? await mkdtemp(join(output, ".publish-")) : output;
  const run = async (env) => {
    const result = spawnSync(
      resolve(desktop, "../../node_modules/.bin/electron-builder"),
      [
        ...packageArguments(process.platform, release),
        `--config.directories.output=${directory}`,
      ],
      { cwd: desktop, env, stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
    if (release) {
      const { publish } = parse(
        await readFile(join(desktop, "electron-builder.yml"), "utf8"),
      );
      const { version } = JSON.parse(
        await readFile(join(desktop, "package.json"), "utf8"),
      );
      const github = githubClient(publish, env.GH_TOKEN);
      const publisher = new AppendOnlyPublisher(
        { ...publish, token: env.GH_TOKEN },
        version,
        github,
      );
      const tag = `v${version}`;
      const assets = await publishRelease(
        await releaseArtifacts(directory),
        publisher,
        github,
        tag,
      );
      const { id } = await publisher._release.value;
      /** @type {import("./release-assets.mjs").ReleaseManifest} */
      const manifest = {
        owner: publish.owner,
        repo: publish.repo,
        tag,
        release: id,
        platform: process.platform === "darwin" ? "macos" : "linux",
        assets,
      };
      await writeFile(
        join(output, releaseManifestFilename),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    }
    return 0;
  };
  try {
    process.exitCode =
      release && process.platform === "darwin"
        ? await withSigningFiles(environment, run)
        : await run(environment);
  } finally {
    if (release) await rm(directory, { recursive: true, force: true });
  }
}
