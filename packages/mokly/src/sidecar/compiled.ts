import { createHash } from "node:crypto";
import { createRequire, isBuiltin } from "node:module";
import path from "node:path";

import { AuthoringRuntime } from "../authoring/runtime.js";
import type { BundleCapture } from "../generated/sidecar/BundleCapture.js";
import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { BundleResult } from "../generated/sidecar/BundleResult.js";
import type { CompiledGeneration } from "../generated/sidecar/CompiledGeneration.js";
import type { Module } from "../generated/sidecar/Module.js";
import type { ResolutionPlan } from "../generated/sidecar/ResolutionPlan.js";

import type { Generation } from "./bundle.js";
import { currentFileInputs, everyInput } from "./file-digests.js";
import { sideRequire } from "./importer-resolution.js";
import { ModulePaths } from "./module-paths.js";
import {
  currentEvidence,
  PhysicalInputReader,
} from "./physical-input-reader.js";
import { checkRecipeSize } from "./recipe-size.js";
import { directoryFiles } from "./resolution-inputs.js";
import { toolchainIdentity } from "./toolchain.js";

/**
 * The generation id: the compilation identity `bundle` hashes, plus the core's
 * evaluation digest of the resolved configuration and CSS Modules. The real
 * source root is part of the identity, so equal head and base sources still
 * get separate generations; the binary keys each fragment by this id.
 */
export function generationId(
  identity: string,
  evaluation: string | undefined,
): string {
  return createHash("sha256")
    .update(identity)
    .update(JSON.stringify(evaluation ?? null))
    .digest("hex");
}

/** Retain compiled code while giving every evaluation its own maps and registrations. */
export function restore(
  params: BundleParams,
  compiled: CompiledGeneration,
  modules: Module[],
  id = generationId(compiled.identity, params.evaluation),
): Generation {
  const file = path.resolve(
    params.sourceRoot,
    params.configurationDirectory,
    "package.json",
  );
  const native = createRequire(file);
  let fallback: NodeJS.Require | undefined;
  const resolve = (
    name: string,
    options?: Parameters<NodeJS.RequireResolve>[1],
  ) => {
    if (compiled.peers[name] === null)
      throw Object.assign(
        new Error(
          `could not resolve ${name} under the selected dependency policy`,
        ),
        { code: "MODULE_NOT_FOUND" },
      );
    if (compiled.peers[name] !== undefined) return compiled.peers[name]!;
    if (isBuiltin(name)) return native.resolve(name, options);
    fallback ??= sideRequire(ModulePaths.createSync(params), file);
    return fallback.resolve(name, options);
  };
  const require = ((name: string) => native(resolve(name))) as NodeJS.Require;
  Object.assign(require, native);
  require.resolve = Object.assign(
    (name: string, options?: Parameters<NodeJS.RequireResolve>[1]) =>
      resolve(name, options),
    { paths: native.resolve.paths },
  );
  return {
    id,
    params,
    modules,
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
    require,
  };
}

export function bundleResult(
  generation: Generation,
  plan?: ResolutionPlan,
  checkSize = checkRecipeSize,
): BundleResult {
  const result: BundleResult = {
    ...(plan ? { plan } : {}),
    generation: generation.id,
    unmappedDependencyDirectories:
      generation.compiled.unmappedDependencyDirectories ?? [],
    modules: generation.modules,
    compiled: generation.compiled,
  };
  checkSize(generation.params, result);
  return result;
}

/** A live compilation can serve another evaluation only while its consumed inputs agree. */
export async function reuse(
  generations: Iterable<Generation>,
  params: BundleParams,
  capture: BundleCapture = "full",
  selected?: (source: Generation) => void,
): Promise<Generation | undefined> {
  const paths = await ModulePaths.create(params);
  params = { ...params, sourceRoot: paths.sourceRoot };
  const settings = (value: BundleParams) =>
    JSON.stringify({ ...value, evaluation: undefined });
  const toolchain = await toolchainIdentity();
  const candidates = [...generations];
  const captured = candidates.filter(
    ({ compiled: { reuseEvidence } }) =>
      reuseEvidence.complete && reuseEvidence.uncaptured === undefined,
  );
  const uncaptured =
    capture === "serveEdit"
      ? candidates.filter(
          ({ compiled: { reuseEvidence } }) =>
            !reuseEvidence.complete &&
            !reuseEvidence.durable &&
            reuseEvidence.uncaptured === "serveEdit" &&
            Object.values(reuseEvidence.inputs).every((value) =>
              ["file", "absent", "link"].includes(value.kind),
            ),
        )
      : [];
  for (const generation of [...captured, ...uncaptured]) {
    if (
      !toolchain ||
      generation.compiled.toolchain !== toolchain ||
      settings(generation.params) !== settings(params) ||
      JSON.stringify(generation.dependencyRoots) !==
        JSON.stringify(paths.dependencyRoots)
    )
      continue;
    const current =
      (await currentFileInputs(generation.compiled.inputs)) &&
      (await everyInput(
        Object.entries(generation.compiled.inputDirectories),
        async ([directory, names]) =>
          JSON.stringify(await directoryFiles(directory)) ===
          JSON.stringify(names),
      )) &&
      (generation.compiled.reuseEvidence.complete
        ? currentEvidence(generation.compiled.reuseEvidence)
        : !Object.keys(generation.compiled.reuseEvidence.inputs).length ||
          new PhysicalInputReader().markedCurrent(
            generation.compiled.reuseEvidence,
          ));
    if (current) {
      selected?.(generation);
      return restore(params, generation.compiled, generation.modules);
    }
  }
}
