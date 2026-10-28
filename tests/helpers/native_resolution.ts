import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import { build } from "esbuild";
import type { PluginBuild } from "esbuild";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { BundleResult } from "../../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { CompiledGeneration } from "../../packages/mokly/src/generated/sidecar/CompiledGeneration.js";
import { bundleWith } from "../../packages/mokly/src/sidecar/bundle.js";
import { unmeasured } from "../../packages/mokly/src/sidecar/measurements.js";

import { bundleParams } from "./sidecar.js";

/** Count compilations and the resolver round trips that each plugin requests. */
export function countedCompile() {
  const counts = { compilations: 0, resolves: new Map<string, number>() };
  const compile: typeof build = (options) => {
    counts.compilations += 1;
    for (const plugin of options.plugins ?? []) {
      const setup = plugin.setup;
      plugin.setup = (builder) =>
        setup(
          new Proxy(builder, {
            get(target, key, receiver) {
              if (key !== "resolve") return Reflect.get(target, key, receiver);
              return (...args: Parameters<PluginBuild["resolve"]>) => {
                counts.resolves.set(
                  plugin.name,
                  (counts.resolves.get(plugin.name) ?? 0) + 1,
                );
                return target.resolve(...args);
              };
            },
          }),
        );
    }
    return build(options);
  };
  return {
    compile,
    counts,
    /** Round trips that the consumer plugin's own resolve callbacks request. */
    consumerResolves: () => counts.resolves.get("mokly-consumer") ?? 0,
  };
}

/** A real temporary root, so that native and mapped paths compare equal. */
export async function nativeRoot(context: TestContext): Promise<string> {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "mokly-native-")),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

export async function write(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
}

/** A package directory with a manifest and its main module. */
export async function packageAt(
  directory: string,
  name: string,
  source: string,
  main = "index.mjs",
): Promise<string> {
  await write(
    path.join(directory, "package.json"),
    JSON.stringify({ name, main }),
  );
  await write(path.join(directory, main), source);
  return directory;
}

export async function link(target: string, file: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.symlink(target, file, "junction");
}

/** Bundle parameters for one entry with this side's selected roots. */
export function nativeParams(
  sourceRoot: string,
  overrides: Partial<BundleParams> = {},
  resolution: Partial<BundleParams["moduleResolution"]> = {},
): BundleParams {
  return bundleParams({
    sourceRoot,
    entryFiles: ["entry.mjs"],
    storiesFiles: [],
    renderer: null,
    ...overrides,
    moduleResolution: {
      ...bundleParams().moduleResolution,
      packageRoots: [sourceRoot],
      ...resolution,
    },
  });
}

interface Fingerprint {
  modules: BundleResult["modules"];
  unmapped: BundleResult["unmappedDependencyDirectories"];
  compiled: Omit<CompiledGeneration, "runtimeKey">;
}

/** Every bundle result field, with the random runtime key replaced. */
export function fingerprint(result: BundleResult): Fingerprint {
  if (!result.compiled) throw new Error("the bundle result has no recipe");
  const { runtimeKey, ...compiled } = result.compiled;
  return {
    modules: result.modules,
    unmapped: result.unmappedDependencyDirectories,
    compiled: {
      ...compiled,
      code: compiled.code.replaceAll(runtimeKey, "mokly:runtime"),
      cssModules: [...compiled.cssModules].sort(),
    },
  };
}

/** The bundle equals the full-path bundle of the same parameters. */
export async function assertFullPathResult(
  params: BundleParams,
  result: BundleResult,
): Promise<void> {
  const full = await bundleWith(params, build, unmeasured, { mode: "full" });
  assert.deepEqual(fingerprint(result), fingerprint(full.result));
}

/** The diagnostic that the full path reports for the same parameters. */
export async function fullPathError(params: BundleParams): Promise<string> {
  const error = await bundleWith(params, build, unmeasured, {
    mode: "full",
  }).then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!(error instanceof Error)) throw new Error("the full path succeeded");
  return error.message;
}

export function moduleNames(result: BundleResult): string[] {
  return result.modules.map((module) => module.path);
}
