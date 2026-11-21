import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";

import type { build, BuildResult } from "esbuild";

import type { AuthoringRuntime } from "../authoring/runtime.js";
import type { BundleCapture } from "../generated/sidecar/BundleCapture.js";
import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { BundleResult } from "../generated/sidecar/BundleResult.js";
import type { CompiledGeneration } from "../generated/sidecar/CompiledGeneration.js";
import type { Definitions } from "../generated/sidecar/Definitions.js";
import type { EntryBinding } from "../generated/sidecar/EntryBinding.js";
import type { Module } from "../generated/sidecar/Module.js";
import type { PlannedImport } from "../generated/sidecar/PlannedImport.js";

import { entryModule } from "./bundle-entry.js";
import { bundleDetail } from "./bundle-errors.js";
import type { VirtualOrigin } from "./bundle-errors.js";
import { bundleOptions } from "./bundle-options.js";
import { bundleRecipe } from "./bundle-recipe.js";
import type { CaptureDurability } from "./capture-durability.js";
import { SidecarError } from "./errors.js";
import { unmeasured } from "./measurements.js";
import type { Measurements } from "./measurements.js";
import { metadataRuntime } from "./metadata-proof.js";
import { ModulePaths } from "./module-paths.js";
import { planNative } from "./native-plan.js";
import { nativeResolveFilter } from "./native-resolution.js";
import type { Resolution } from "./native-resolution.js";
import { consumerRequire } from "./paths.js";
import { PlannedRelative } from "./planned-relative.js";
import { ResolutionEvidence } from "./resolution-evidence.js";
import { ServeEditImports } from "./serve-edit-imports.js";

export interface Generation {
  modules: Module[];
  compiled: CompiledGeneration;
  id: string;
  params: BundleParams;
  dependencyRoots: string[];
  code: string;
  runtimeKey: string;
  bindings?: Record<string, EntryBinding>;
  maps?: Record<string, Record<string, string>>;
  cssModules: Set<string>;
  runtime: AuthoringRuntime;
  exports?: BundleExports;
  definitions?: Definitions;
  handles: Map<string, object>;
  registrations: Map<object, { handle: string; path?: string }>;
  savedSlots: Map<string, unknown>;
  sources: Map<string, string>;
  stories: Map<string, unknown>;
  require: NodeJS.Require;
}
export interface BundleExports {
  entries: Record<string, Record<string, unknown>>;
  stories: Record<string, Record<string, unknown>>;
  renderer?: { default?: unknown };
  preview?: Record<string, unknown>;
  styleAdapters?: { styled?: unknown; native?: unknown; emotion?: unknown };
}

export interface Bundled {
  generation: Generation;
  result: BundleResult;
}

/** A native compile that is not final: its plan, or none after a failure. */
interface NativeOutcome {
  plan?: ReadonlyMap<string, PlannedImport>;
}

interface BundleCaptureState {
  started: bigint;
  mode: BundleCapture;
  reads: Map<string, Uint8Array>;
  durability?: CaptureDurability | undefined;
  evidence?: ResolutionEvidence;
  preview?: string | null | undefined;
  plan?: ReadonlyMap<string, PlannedImport>;
  editImports?: ServeEditImports;
}

/**
 * Compile directly from a requested edit plan, or start with native resolution.
 * A native result that a resolve callback could not reproduce compiles again
 * from its plan. A failed native compile compiles again on the full path.
 */
export async function bundle(
  params: BundleParams,
  compile: typeof build,
  measurements: Measurements = unmeasured,
  durability?: CaptureDurability,
  captureMode: BundleCapture = "full",
  requestedPlan?: BundleResult["plan"],
): Promise<Bundled> {
  const capture: BundleCaptureState = {
    started: metadataRuntime.now(),
    mode: captureMode,
    reads: new Map(),
    ...(captureMode === "full" ? { durability } : {}),
  };
  if (captureMode === "serveEdit" && requestedPlan)
    return bundleAttempt(
      params,
      compile,
      measurements,
      {
        mode: "planned",
        plan: new Map(Object.entries(requestedPlan.imports)),
      },
      capture,
    );
  const native = await bundleAttempt(
    params,
    compile,
    measurements,
    { mode: "native" },
    capture,
  );
  if ("generation" in native) return native;
  return bundleAttempt(
    params,
    compile,
    measurements,
    native.plan ? { mode: "planned", plan: native.plan } : { mode: "full" },
    capture,
    true,
  );
}

/** One compile attempt; a native attempt reports a plan instead of failing. */
export async function bundleWith(
  params: BundleParams,
  compile: typeof build,
  measurements: Measurements,
  resolution: { mode: "native" },
): Promise<Bundled | NativeOutcome>;
export async function bundleWith(
  params: BundleParams,
  compile: typeof build,
  measurements: Measurements,
  resolution: Exclude<Resolution, { mode: "native" }>,
): Promise<Bundled>;
export async function bundleWith(
  params: BundleParams,
  compile: typeof build,
  measurements: Measurements,
  resolution: Resolution,
): Promise<Bundled | NativeOutcome> {
  return bundleAttempt(params, compile, measurements, resolution, {
    started: metadataRuntime.now(),
    mode: "full",
    reads: new Map(),
  });
}

async function bundleAttempt(
  params: BundleParams,
  compile: typeof build,
  measurements: Measurements,
  resolution: Exclude<Resolution, { mode: "native" }>,
  capture: BundleCaptureState,
  completePlan?: boolean,
): Promise<Bundled>;
async function bundleAttempt(
  params: BundleParams,
  compile: typeof build,
  measurements: Measurements,
  resolution: Resolution,
  capture: BundleCaptureState,
  completePlan?: boolean,
): Promise<Bundled | NativeOutcome>;
async function bundleAttempt(
  params: BundleParams,
  compile: typeof build,
  measurements: Measurements,
  resolution: Resolution,
  capture: BundleCaptureState,
  completePlan = false,
): Promise<Bundled | NativeOutcome> {
  const virtualOrigins = new Map<string, VirtualOrigin>();
  let sources: ModulePaths | undefined;
  try {
    if (!capture.evidence) await capture.durability?.prepare(params);
    const runtimeKey = `mokly:runtime:${randomBytes(24).toString("hex")}`;
    params = { ...params, sourceRoot: await fs.realpath(params.sourceRoot) };
    const paths = await ModulePaths.create(params);
    sources = paths;
    if (capture.mode === "full" && !capture.evidence) {
      const evidence = new ResolutionEvidence(
        params,
        paths,
        capture.durability,
      );
      capture.preview = await evidence.prepare();
      capture.evidence = evidence;
    }
    const { evidence } = capture;
    if (capture.mode === "serveEdit")
      capture.editImports ??= new ServeEditImports(params, paths);
    const require = await consumerRequire(params, paths);
    const inputs = {
      files: new Map<string, Uint8Array>(),
      cssModules: new Set<string>(),
      virtualOrigins,
    };
    const { contents, inputPaths, preview } = await entryModule(
      params,
      capture.preview,
      capture.mode,
    );
    capture.preview = preview ?? null;
    const relative =
      capture.mode === "serveEdit" &&
      resolution.mode === "planned" &&
      !completePlan
        ? await PlannedRelative.create(resolution.plan, capture.started).catch(
            () => undefined,
          )
        : undefined;
    const editImports =
      relative && capture.mode === "serveEdit"
        ? new ServeEditImports(params, paths)
        : capture.editImports;
    const retryPlanned = () =>
      bundleAttempt(params, compile, measurements, resolution, capture, true);
    const nativeRelatives =
      capture.mode === "serveEdit" && resolution.mode === "native";
    const options = bundleOptions({
      params,
      paths,
      inputs,
      require,
      runtimeKey,
      resolution,
      reads: capture.reads,
      contents,
      preview,
      evidence,
      editImports,
      resolveFilters: nativeRelatives
        ? [nativeResolveFilter]
        : relative?.filters,
      handledImports: relative?.handled,
    });
    let compiled: BuildResult<typeof options>;
    try {
      compiled = await measurements.run("sidecar.bundle.compile", () =>
        compile(options),
      );
    } catch (error) {
      if (resolution.mode === "native") return {};
      if (relative) return retryPlanned();
      throw error;
    }
    if (
      relative &&
      !(await relative.verify(compiled.metafile, paths).catch(() => false))
    )
      return retryPlanned();
    if (resolution.mode === "native") {
      const { metafile } = compiled;
      const plan = await measurements
        .run("sidecar.bundle.classify", () =>
          planNative(metafile, paths, nativeRelatives),
        )
        .catch(() => undefined);
      if (!plan) return {};
      if (capture.mode === "full") capture.plan = plan.imports;
      if (!plan.exact) return { plan: plan.imports };
    }
    return await bundleRecipe(
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
        plan: capture.plan,
      },
      measurements,
    );
  } catch (error) {
    throw new SidecarError(
      "bundle-failed",
      bundleDetail(error, params.sourceRoot, virtualOrigins, sources),
    );
  }
}
