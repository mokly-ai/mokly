import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { AuthoringRuntime } from "../authoring/runtime.js";
import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { BundleResult } from "../generated/sidecar/BundleResult.js";
import type { CompiledGeneration } from "../generated/sidecar/CompiledGeneration.js";

import type { Generation } from "./bundle.js";
import { ModulePaths } from "./module-paths.js";

export function generationId(
  identity: string,
  evaluation: string | undefined,
): string {
  return createHash("sha256")
    .update(identity)
    .update(JSON.stringify(evaluation ?? null))
    .digest("hex");
}

export async function fileDigest(file: string): Promise<string | null> {
  try {
    return createHash("sha256")
      .update(await fs.readFile(file))
      .digest("hex");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["ENOENT", "ENOTDIR"].includes(String(error.code))
    )
      return null;
    throw error;
  }
}

/** Retain compiled code while giving every evaluation its own maps and registrations. */
export function restore(
  params: BundleParams,
  compiled: CompiledGeneration,
  id = generationId(compiled.identity, params.evaluation),
): Generation {
  const native = createRequire(
    path.resolve(
      params.sourceRoot,
      params.configurationDirectory,
      "package.json",
    ),
  );
  const require = ((name: string) =>
    native(compiled.peers[name] ?? name)) as NodeJS.Require;
  Object.assign(require, native);
  require.resolve = Object.assign(
    (name: string, options?: Parameters<NodeJS.RequireResolve>[1]) =>
      compiled.peers[name] ?? native.resolve(name, options),
    { paths: native.resolve.paths },
  );
  return {
    id,
    params,
    compiled,
    code: compiled.code,
    runtimeKey: compiled.runtimeKey,
    dependencyRoots: compiled.dependencyRoots,
    cssModules: new Set(compiled.cssModules),
    sources: new Map(Object.entries(compiled.sources)),
    runtime: new AuthoringRuntime(),
    handles: new Map(),
    registrations: new Map(),
    savedSlots: new Map(),
    stories: new Map(),
    warnings: [],
    require,
  };
}

export function bundleResult(generation: Generation): BundleResult {
  return {
    generation: generation.id,
    modules: generation.compiled.modules,
    warnings: [],
    compiled: generation.compiled,
  };
}

/** A live compilation can serve another evaluation only while its consumed inputs agree. */
export async function reuse(
  generations: Iterable<Generation>,
  params: BundleParams,
): Promise<Generation | undefined> {
  const paths = await ModulePaths.create(params);
  params = { ...params, sourceRoot: paths.sourceRoot };
  const settings = (value: BundleParams) =>
    JSON.stringify({ ...value, evaluation: undefined });
  for (const generation of generations) {
    if (
      settings(generation.params) !== settings(params) ||
      JSON.stringify(generation.dependencyRoots) !==
        JSON.stringify(paths.dependencyRoots)
    )
      continue;
    const inputs = Object.entries(generation.compiled.inputs);
    let current = true;
    for (const [file, digest] of inputs) {
      if ((await fileDigest(file)) !== digest) {
        current = false;
        break;
      }
    }
    if (current) return restore(params, generation.compiled);
  }
}
