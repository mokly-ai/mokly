import { createHash } from "node:crypto";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";

import type * as StorybookCommon from "storybook/internal/common";

import { detail } from "./errors.js";
import { missingFile } from "./file-digests.js";
import { ModulePaths } from "./module-paths.js";
import { readEvidence } from "./postcss-evidence.js";
import { fileIdentity } from "./postcss-file-identity.js";
import { observeDescriptors } from "./postcss-read-descriptors.js";
import { observeFileReads } from "./postcss-read-files.js";
import { resolutionMetadata } from "./postcss-resolution-evidence.js";
import { isRecord } from "./storybook-main.js";
import type { MainRequest, MainResult } from "./storybook-main.js";
import { withViteConfigResolution } from "./vite-config-resolution.js";
import { ViteLookup } from "./vite-resolution.js";

const request: MainRequest = workerData;
const { openSync, fstatSync, readSync, closeSync } = fs;
const buffer = Buffer.allocUnsafe(64 * 1024);

function descriptorDigest(fd: number): string {
  const hash = createHash("sha256");
  let offset = 0;
  for (;;) {
    const count = readSync(fd, buffer, 0, buffer.length, offset);
    if (count === 0) return hash.digest("hex");
    hash.update(buffer.subarray(0, count));
    offset += count;
  }
}

function moduleDigest(file: string): string | null {
  try {
    const fd = openSync(file, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
    try {
      return fstatSync(fd).isFile() ? descriptorDigest(fd) : null;
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    if (missingFile(error)) return null;
    throw error;
  }
}

async function read(
  { common, base, stories }: MainRequest,
  paths: ModulePaths,
): Promise<MainResult> {
  const files = new Map<string, string | null>();
  const record = (file: string) => {
    if (!files.has(file)) files.set(file, moduleDigest(file));
  };
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      const result = next(specifier, context);
      if (result.url.startsWith("file:")) record(fileURLToPath(result.url));
      for (const file of resolutionMetadata(
        specifier,
        context.parentURL,
        result.url,
      ))
        record(file);
      return result;
    },
  });
  const opened = new Map<string, string>();
  const recordRead = (file: string, digest: string, canonical?: string) => {
    opened.set(file, digest);
    if (canonical && canonical !== file) opened.set(canonical, digest);
  };
  observeDescriptors((fd, file) => {
    if (!paths.repositoryOwned(file)) return;
    const identity = fileIdentity(fd, file);
    if (!identity) return;
    try {
      recordRead(file, descriptorDigest(fd), identity.canonical);
    } catch {
      // A descriptor that cannot supply bytes keeps its native behaviour.
    }
  });
  observeFileReads();
  try {
    const loader: typeof StorybookCommon = await import(
      pathToFileURL(common).href
    );
    const main = loader.getInterpretedFile(base);
    if (main) record(main);
    const config: unknown = await loader.serverRequire(base);
    const framework = isRecord(config) ? config.framework : undefined;
    const name = isRecord(framework) ? framework.name : framework;
    const entries = stories
      ? normalizeEntries(
          loader,
          isRecord(config) ? config.stories : undefined,
          path.dirname(base),
          paths.sourceRoot,
        )
      : undefined;
    for (const observed of readEvidence([]).reads) {
      if (observed.kind === "whole-file")
        recordRead(
          observed.path,
          observed.digest,
          observed.identity?.canonical,
        );
    }
    const inputs = new Map([...files, ...opened]);
    return {
      ...(typeof name === "string" ? { framework: name } : {}),
      ...(entries && { entries }),
      inputs: [...inputs].sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    };
  } catch (error) {
    return { error: detail(error), inputs: [] };
  } finally {
    hooks.deregister();
  }
}

function normalizeEntries(
  loader: typeof StorybookCommon,
  stories: unknown,
  configDir: string,
  workingDir: string,
): NonNullable<MainResult["entries"]> {
  if (!Array.isArray(stories)) throw new Error("expected a stories array");
  return Array.from(stories, (value: unknown, index) => {
    try {
      const entry = typeof value === "string" ? value : readEntry(value);
      const { directory, files } = loader.normalizeStoriesEntry(entry, {
        configDir,
        workingDir,
      });
      return { directory, files };
    } catch (error) {
      throw new Error(`stories[${index}]: ${detail(error)}`, { cause: error });
    }
  });
}

function readEntry(entry: unknown): { directory: string; files?: string } {
  if (!isRecord(entry) || typeof entry.directory !== "string")
    throw new Error("expected a string or an object with a directory");
  if (entry.files !== undefined && typeof entry.files !== "string")
    throw new Error("files must be a string");
  return {
    directory: entry.directory,
    ...(entry.files !== undefined && { files: entry.files }),
  };
}

const paths = ModulePaths.createSync(request.side);
const lookup = new ViteLookup(
  paths,
  path.resolve(paths.sourceRoot, request.side.configurationDirectory),
);
parentPort?.postMessage(
  await withViteConfigResolution(lookup, () => read(request, paths)),
);
