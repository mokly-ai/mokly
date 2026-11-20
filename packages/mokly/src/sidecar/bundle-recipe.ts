import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { BuildResult } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { CompiledGeneration } from "../generated/sidecar/CompiledGeneration.js";
import type { PlannedImport } from "../generated/sidecar/PlannedImport.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { previewCandidates } from "./bundle-entry.js";
import { moduleGraph } from "./bundle-graph.js";
import type { Bundled } from "./bundle.js";
import { capturedPlan } from "./captured-plan.js";
import { bundleResult, generationId, restore } from "./compiled.js";
import { metadataDigest } from "./file-digests.js";
import type { Measurements } from "./measurements.js";
import type { ModulePaths } from "./module-paths.js";
import type { ConsumerRequire } from "./paths.js";
import type { ResolutionEvidence } from "./resolution-evidence.js";
import { resolutionInputs } from "./resolution-inputs.js";
import type { ServeEditImports } from "./serve-edit-imports.js";
import { toolchainIdentity } from "./toolchain.js";

/** One finished compile and the state that its plugins recorded. */
export interface CompiledBundle {
  params: BundleParams;
  paths: ModulePaths;
  require: ConsumerRequire;
  inputs: { files: Map<string, Uint8Array>; cssModules: Set<string> };
  compiled: Pick<BuildResult, "metafile" | "outputFiles">;
  inputPaths: Map<string, string>;
  preview: string | null | undefined;
  runtimeKey: string;
  evidence: ResolutionEvidence | undefined;
  editImports: ServeEditImports | undefined;
  plan: ReadonlyMap<string, PlannedImport> | undefined;
}

/** The module graph, consumed digests, resolution inputs, and the recipe. */
export async function bundleRecipe(
  {
    params,
    paths,
    require,
    inputs,
    compiled,
    inputPaths,
    preview,
    runtimeKey,
    evidence,
    editImports,
    plan,
  }: CompiledBundle,
  measurements: Measurements,
): Promise<Bundled> {
  const folderEvidence = editImports
    ? measurements.runSync("sidecar.bundle.mapped-lookups", () =>
        editImports.record(compiled.metafile!, paths),
      )
    : undefined;
  const resolution = params.moduleResolution;
  const { modules: graph, physical } = measurements.runSync(
    "sidecar.bundle.graph",
    () => moduleGraph(compiled.metafile!, paths),
  );
  // The compilation identity: module paths, imports and non-CSS source and
  // loader bytes, then the metadata inputs and the settings hashed below.
  const hash = createHash("sha256");
  const physicalInputs: Record<string, string | null> = {};
  const metadataInputs: Record<string, string | null> = {};
  measurements.runSync("sidecar.bundle.inputs", () => {
    for (const module of graph) {
      const absolute = physical.get(module.path)!;
      // Digest the bytes the compiler consumed, as the plugins recorded
      // them; a later read could see a newer file, so an unrecorded input
      // fails the bundle.
      const text = inputs.files.get(absolute);
      if (text === undefined)
        throw new Error(
          `Bundled source bytes were not recorded: ${module.path}`,
        );
      module.digest = createHash("sha256").update(text).digest("hex");
      hash.update(JSON.stringify([module.path, module.imports]));
      if (!module.path.endsWith(".css")) {
        hash.update(text);
        physicalInputs[absolute] = module.digest;
      }
    }
  });
  for (const file of params.storiesFiles.length ? previewCandidates : []) {
    const absolute = path.resolve(params.sourceRoot, file);
    metadataInputs[file] = physicalInputs[absolute] = await metadataDigest(
      absolute,
      physicalInputs,
    );
  }
  for (const root of paths.dependencyRoots) {
    const file = path.join(root, "react/package.json");
    metadataInputs[paths.name(file)] = physicalInputs[file] =
      await metadataDigest(file, physicalInputs);
  }
  let reactVersion: string | null = null;
  try {
    const file = require.resolve("react/package.json");
    const bytes = await fs.readFile(file);
    reactVersion = JSON.parse(bytes.toString()).version;
    metadataInputs[paths.name(file)] = physicalInputs[file] =
      await metadataDigest(file, physicalInputs, bytes);
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "MODULE_NOT_FOUND"
    ))
      throw error;
  }
  const directories = await measurements.run("sidecar.bundle.resolution", () =>
    resolutionInputs(paths, physical.values(), physicalInputs, metadataInputs),
  );
  const peers = require.snapshot();
  evidence?.peers(peers);
  const reuseEvidence: ReuseEvidence = evidence
    ? await evidence.finish(compiled.metafile!)
    : (folderEvidence ?? {
        complete: false,
        durable: false,
        inputs: {},
      });
  const toolchain = await toolchainIdentity();
  if (!toolchain) {
    reuseEvidence.complete = false;
    delete reuseEvidence.uncaptured;
  }
  const reusable = reuseEvidence.complete;
  if (!reusable) hash.update(JSON.stringify(runtimeKey));
  hash.update(
    JSON.stringify([
      toolchain,
      [...(evidence?.physical.identityInputs ?? [])].sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
      Object.entries(peers).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ]),
  );
  hash.update(JSON.stringify(metadataInputs));
  hash.update(
    JSON.stringify([
      params.sourceRoot,
      paths.dependencyRoots,
      params.entryFiles,
      params.storiesFiles,
      preview,
      params.renderer,
      params.configurationDirectory,
      params.repositoryRoots,
      resolution,
      reactVersion,
    ]),
  );
  const compilation: CompiledGeneration = {
    toolchain: toolchain ?? "",
    ...(reuseEvidence.complete
      ? {
          metadataIdentity: createHash("sha256")
            .update(
              JSON.stringify(
                [...(evidence?.physical.identityInputs ?? [])]
                  .map(([file, value]): [string, string | null] => [
                    path
                      .relative(paths.sourceRoot, file)
                      .split(path.sep)
                      .join("/"),
                    value,
                  ])
                  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
              ),
            )
            .digest("hex"),
        }
      : {}),
    reuseEvidence,
    identity: hash.digest("hex"),
    code: compiled.outputFiles![0]!.text,
    runtimeKey,
    dependencyRoots: paths.dependencyRoots,
    cssModules: [...inputs.cssModules],
    sources: Object.fromEntries(
      [...inputPaths].map(([file, physical]) => [
        file,
        Buffer.from(inputs.files.get(physical) ?? []).toString("utf8"),
      ]),
    ),
    peers,
    unmappedDependencyDirectories: [...paths.dependencyUsage.unmapped].sort(),
    ...directories,
    inputs: physicalInputs,
    metadataInputs,
  };
  const generation = restore(params, compilation, graph);
  const result = bundleResult(generation, capturedPlan(plan, reuseEvidence));
  if (reusable && !compilation.reuseEvidence.complete) {
    delete compilation.metadataIdentity;
    compilation.identity = createHash("sha256")
      .update(compilation.identity)
      .update(runtimeKey)
      .digest("hex");
    generation.id = generationId(compilation.identity, params.evaluation);
    result.generation = generation.id;
  }
  return { generation, result };
}
