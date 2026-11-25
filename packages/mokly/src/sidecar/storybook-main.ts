import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire, findPackageJSON } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { detail } from "./errors.js";
import { fileDigest } from "./file-digests.js";
import { missingModule } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import {
  regularFile,
  storybookCandidates,
  storybookFolders,
} from "./storybook-folders.js";

// The workspace devDependency pins the Storybook versions used by the tests.
const testedRange = "^10.6.2";

export interface MainRequest {
  common: string;
  base: string;
}

export interface MainResult {
  framework?: string;
  error?: string;
  inputs: Array<[string, string | null]>;
}

type Lookup = (name: string, directory: string) => Promise<string | Error>;
export type StorybookMainCache = Map<string, Promise<MainResult>>;

/** Resolve the portable renderer through each folder's framework when needed. */
export async function storybookFrameworks(
  params: BundleParams,
  paths: ModulePaths,
  directory: string,
  lookup: Lookup,
  cache: StorybookMainCache,
  missing: Error,
) {
  const inputs = new Map<string, string | null>();
  const peers = new Map<string, string>();
  for (const folder of storybookFolders(params)) {
    const absolute = path.resolve(paths.sourceRoot, folder);
    const main = await findMain(paths.sourceRoot, folder, inputs);
    if (!main) throw missing;
    const specifier = "storybook/package.json";
    let manifest = await lookup(specifier, directory);
    if (manifest instanceof Error)
      manifest = await lookup(specifier, path.dirname(absolute));
    if (manifest instanceof Error) throw missing;
    let loaded = cache.get(main);
    if (!loaded) {
      loaded = loadMain(main, absolute, manifest, paths.sourceRoot);
      cache.set(main, loaded);
    }
    const result = await loaded;
    for (const [file, digest] of result.inputs) inputs.set(file, digest);
    if (!result.framework) throw missing;
    const framework = await lookup(result.framework, absolute);
    if (framework instanceof Error) throw missing;
    const react = await resolveReact(paths, framework);
    if (!react) throw missing;
    for (const file of [framework, react]) {
      inputs.set(file, await fileDigest(file));
      const manifest = findPackageJSON(pathToFileURL(file).href);
      if (manifest) inputs.set(manifest, await fileDigest(manifest));
    }
    peers.set(folder, react);
  }
  return { inputs, peers: Object.fromEntries(peers) };
}

async function findMain(
  root: string,
  folder: string,
  inputs: Map<string, string | null>,
) {
  for (const candidate of storybookCandidates(folder, "main")) {
    const file = path.resolve(root, candidate);
    if (await regularFile(file)) return file;
    inputs.set(file, null);
  }
}

async function loadMain(
  file: string,
  directory: string,
  manifest: string,
  root: string,
): Promise<MainResult> {
  let version = "unknown";
  try {
    const bytes = await fs.readFile(manifest);
    const json: unknown = JSON.parse(bytes.toString());
    if (isRecord(json) && typeof json.version === "string")
      version = json.version;
    const common = createRequire(manifest).resolve("storybook/internal/common");
    if (!inside(root, await fs.realpath(file)))
      throw new Error("source is outside sourceRoot");
    const result = await runMain({
      common,
      base: path.join(directory, "main"),
    });
    if (result.error !== undefined) throw new Error(result.error);
    result.inputs.push([
      manifest,
      createHash("sha256").update(bytes).digest("hex"),
    ]);
    return result;
  } catch (error) {
    throw new Error(
      `${logical(root, file)}: Storybook ${version} (tested ${testedRange}): ${detail(error)}`,
      { cause: error },
    );
  }
}

async function resolveReact(
  paths: ModulePaths,
  framework: string,
): Promise<string | undefined> {
  try {
    const react = createRequire(framework).resolve("@storybook/react");
    return await paths.resolve(react, "@storybook/react");
  } catch (error) {
    if (!missingModule(error)) throw error;
  }
}

async function runMain(request: MainRequest): Promise<MainResult> {
  // Storybook registers an async TypeScript loader. Keep that loader and the
  // config's module cache local to this read, even across edits in Serve.
  const extension = path.extname(new URL(import.meta.url).pathname);
  const worker = new Worker(
    new URL(`./storybook-main-worker${extension}`, import.meta.url),
    {
      workerData: request,
      stdout: true,
      stderr: true,
    },
  );
  worker.stdout.resume();
  worker.stderr.resume();
  try {
    return await new Promise<MainResult>((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
      worker.once("exit", (code) =>
        reject(new Error(`Storybook loader exited with code ${code}`)),
      );
    });
  } finally {
    await worker.terminate();
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
