import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire, findPackageJSON } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { ReadStorybookParams } from "../generated/sidecar/ReadStorybookParams.js";
import type { ReadStorybookReply } from "../generated/sidecar/ReadStorybookReply.js";
import type { ReadStorybookResult } from "../generated/sidecar/ReadStorybookResult.js";

import { detail } from "./errors.js";
import { fileDigest } from "./file-digests.js";
import { dependencyDirectory } from "./importer-resolution.js";
import { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import {
  regularFile,
  storybookCandidates,
  storybookFolders,
} from "./storybook-folders.js";
import { viteMissingImport } from "./vite-lookup-paths.js";
import { ViteLookup } from "./vite-resolution.js";

// The workspace devDependency pins the Storybook versions used by the tests.
const testedRange = "^10.6.2";

export interface MainRequest {
  common: string;
  base: string;
  stories?: ReadStorybookParams;
}

export interface MainResult {
  framework?: string;
  entries?: ReadStorybookResult["entries"];
  error?: string;
  inputs: Array<[string, string | null]>;
}

type Lookup = (name: string, directory: string) => Promise<string | Error>;
export type StorybookMainCache = Map<string, Promise<MainResult>>;

/** Read the selected main file with the package lookup of this source side. */
export async function readStorybook(
  params: ReadStorybookParams,
): Promise<ReadStorybookReply> {
  const paths = await ModulePaths.create(params);
  const directory = path.resolve(paths.sourceRoot, params.folder);
  const reads = new Map<string, string | null>();
  const main = await findMain(paths.sourceRoot, params.folder, reads);
  if (!main)
    return {
      mainError: `${path.posix.join(params.folder, "main.*")}: no main file found`,
    };

  const name = logical(paths.sourceRoot, main);
  const config = path.resolve(paths.sourceRoot, params.configurationDirectory);
  const lookup = new ViteLookup(paths, config);
  const resolve = (from: string) =>
    fileURLToPath(
      lookup.sync(
        "storybook/package.json",
        path.join(from, "package.json"),
        (specifier, parent) =>
          pathToFileURL(createRequire(parent).resolve(specifier)).href,
      ),
    );
  let manifest: string;
  try {
    try {
      manifest = resolve(config);
    } catch (error) {
      if (!viteMissingImport(error)) throw error;
      manifest = resolve(path.dirname(directory));
    }
  } catch (error) {
    return { mainError: `${name}: ${detail(error)}` };
  }
  const result = await loadMain(
    main,
    directory,
    manifest,
    paths.sourceRoot,
    params,
  );
  if (result.error !== undefined) return { mainError: result.error };
  const dependencies = new Set<string>();
  const dependencyRoot = paths.dependencyRoot ?? paths.sourceRoot;
  for (const [file, digest] of result.inputs) {
    if (digest !== null) reads.set(file, digest);
    const dependency = dependencyDirectory(dependencyRoot, file);
    if (dependency) dependencies.add(logical(dependencyRoot, dependency));
  }
  return {
    main: name,
    entries: result.entries ?? [],
    inputs: Object.fromEntries(
      [...reads]
        .filter(([file]) => paths.repositoryOwned(file))
        .map(([file, digest]) => [logical(paths.sourceRoot, file), digest]),
    ),
    dependencyDirectories: [...dependencies].sort(),
  };
}

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
    if (result.error !== undefined) throw new Error(result.error);
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
  let main: string | undefined;
  for (const candidate of storybookCandidates(folder, "main")) {
    const file = path.resolve(root, candidate);
    const present = await regularFile(file);
    if (present && main === undefined) main = file;
    else inputs.set(file, present ? await fileDigest(file) : null);
  }
  return main;
}

async function loadMain(
  file: string,
  directory: string,
  manifest: string,
  root: string,
  stories?: ReadStorybookParams,
): Promise<MainResult> {
  let version = "unknown";
  const failure = (error: unknown) =>
    `${logical(root, file)}: Storybook ${version} (tested ${testedRange}): ${detail(error)}`;
  let bytes: Buffer;
  let common: string;
  try {
    bytes = await fs.readFile(manifest);
    const json: unknown = JSON.parse(bytes.toString());
    if (isRecord(json) && typeof json.version === "string")
      version = json.version;
    common = createRequire(manifest).resolve("storybook/internal/common");
    if (!inside(root, await fs.realpath(file)))
      throw new Error("source is outside sourceRoot");
  } catch (error) {
    return { error: failure(error), inputs: [] };
  }
  const result = await runMain({
    common,
    base: path.join(directory, "main"),
    ...(stories && { stories }),
  }).catch((error: unknown) => {
    throw new Error(failure(error), { cause: error });
  });
  if (result.error !== undefined)
    return { error: failure(result.error), inputs: [] };
  result.inputs.push([
    manifest,
    createHash("sha256").update(bytes).digest("hex"),
  ]);
  return result;
}

async function resolveReact(
  paths: ModulePaths,
  framework: string,
): Promise<string | undefined> {
  try {
    const react = createRequire(framework).resolve("@storybook/react");
    return await paths.resolve(react, "@storybook/react");
  } catch (error) {
    if (!viteMissingImport(error)) throw error;
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
