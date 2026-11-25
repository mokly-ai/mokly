import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";

import type * as StorybookCommon from "storybook/internal/common";

import { detail } from "./errors.js";
import { fileDigest } from "./file-digests.js";
import { ModulePaths } from "./module-paths.js";
import { readEvidence } from "./postcss-evidence.js";
import { observeFileReads } from "./postcss-read-files.js";
import { resolutionMetadata } from "./postcss-resolution-evidence.js";
import { isRecord } from "./storybook-main.js";
import type { MainRequest, MainResult } from "./storybook-main.js";
import { withViteConfigResolution } from "./vite-config-resolution.js";
import { ViteLookup } from "./vite-resolution.js";

const request: MainRequest = workerData;

async function read({
  common,
  base,
  stories,
}: MainRequest): Promise<MainResult> {
  const files = new Map<string, Promise<string | null>>();
  const record = (file: string) => {
    if (!files.has(file)) files.set(file, fileDigest(file));
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
  observeFileReads();
  try {
    const loader: typeof StorybookCommon = await import(
      pathToFileURL(common).href
    );
    const main = loader.getInterpretedFile(base);
    if (main) record(main);
    const config: unknown = stories
      ? await withViteConfigResolution(
          new ViteLookup(
            ModulePaths.createSync(stories),
            path.resolve(stories.sourceRoot, stories.configurationDirectory),
          ),
          () => loader.serverRequire(base),
        )
      : await loader.serverRequire(base);
    const framework = isRecord(config) ? config.framework : undefined;
    const name = isRecord(framework) ? framework.name : framework;
    const entries = stories
      ? normalizeEntries(
          loader,
          isRecord(config) ? config.stories : undefined,
          path.dirname(base),
          stories.sourceRoot,
        )
      : undefined;
    const inputs = new Map<string, string | null>();
    for (const [file, digest] of files) inputs.set(file, await digest);
    for (const observed of readEvidence([]).reads) {
      if (observed.kind === "whole-file")
        inputs.set(observed.path, observed.digest);
    }
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

parentPort?.postMessage(await read(request));
