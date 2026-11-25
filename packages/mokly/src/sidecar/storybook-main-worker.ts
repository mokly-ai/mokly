import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";

import type * as StorybookCommon from "storybook/internal/common";

import { detail } from "./errors.js";
import { fileDigest } from "./file-digests.js";
import { readEvidence } from "./postcss-evidence.js";
import { observeFileReads } from "./postcss-read-files.js";
import { resolutionMetadata } from "./postcss-resolution-evidence.js";
import { isRecord } from "./storybook-main.js";
import type { MainRequest, MainResult } from "./storybook-main.js";

const request: MainRequest = workerData;

async function read({ common, base }: MainRequest): Promise<MainResult> {
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
    const config: unknown = await loader.serverRequire(base);
    const framework = isRecord(config) ? config.framework : undefined;
    const name = isRecord(framework) ? framework.name : framework;
    const inputs = new Map<string, string | null>();
    for (const [file, digest] of files) inputs.set(file, await digest);
    for (const observed of readEvidence([]).reads) {
      if (observed.kind === "whole-file")
        inputs.set(observed.path, observed.digest);
    }
    return {
      ...(typeof name === "string" ? { framework: name } : {}),
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

parentPort?.postMessage(await read(request));
