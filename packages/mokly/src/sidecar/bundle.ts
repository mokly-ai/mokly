import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { build, BuildResult, Loader } from "esbuild";

import type { AuthoringRuntime } from "../authoring/runtime.js";
import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { BundleResult } from "../generated/sidecar/BundleResult.js";
import type { CompiledGeneration } from "../generated/sidecar/CompiledGeneration.js";
import type { Definitions } from "../generated/sidecar/Definitions.js";
import type { EntryBinding } from "../generated/sidecar/EntryBinding.js";
import type { Module } from "../generated/sidecar/Module.js";
import type { Warning } from "../generated/sidecar/Warning.js";

import { entryModule } from "./bundle-entry.js";
import { bundleDetail } from "./bundle-errors.js";
import type { VirtualOrigin } from "./bundle-errors.js";
import { bundleRecipe } from "./bundle-recipe.js";
import { SidecarError } from "./errors.js";
import { unmeasured } from "./measurements.js";
import type { Measurements } from "./measurements.js";
import { ModulePaths } from "./module-paths.js";
import { planNative } from "./native-plan.js";
import { nativeLogOverride } from "./native-resolution.js";
import type { PlannedImport, Resolution } from "./native-resolution.js";
import { consumerRequire } from "./paths.js";
import { consumerPlugins } from "./plugins.js";
import { resolutionOptions } from "./resolution.js";

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
  warnings: Warning[];
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

/**
 * Compile with native resolution first. A native result that a resolve
 * callback result could not reproduce compiles again from its plan, and a
 * failed native compile compiles again on the full path.
 */
export async function bundle(
  params: BundleParams,
  compile: typeof build,
  measurements: Measurements = unmeasured,
): Promise<Bundled> {
  const native = await bundleWith(params, compile, measurements, {
    mode: "native",
  });
  if ("generation" in native) return native;
  return bundleWith(
    params,
    compile,
    measurements,
    native.plan ? { mode: "planned", plan: native.plan } : { mode: "full" },
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
  const virtualOrigins = new Map<string, VirtualOrigin>();
  let sources: ModulePaths | undefined;
  try {
    const runtimeKey = `mokly:runtime:${randomBytes(24).toString("hex")}`;
    params = { ...params, sourceRoot: await fs.realpath(params.sourceRoot) };
    const paths = await ModulePaths.create(params);
    sources = paths;
    const require = await consumerRequire(params, paths);
    const inputs = {
      files: new Map<string, Uint8Array>(),
      cssModules: new Set<string>(),
      virtualOrigins,
    };
    const { contents, inputPaths, preview } = await entryModule(params);
    const settings = params.moduleResolution;
    const loaders = Object.fromEntries(
      Object.entries(settings.loaders).filter(
        ([extension]) => extension !== ".css" && extension !== ".module.css",
      ),
    );
    for (const extension of [".css", ".module.css"]) {
      const value = settings.loaders[extension];
      if (value !== undefined && value !== "empty")
        throw new Error(
          `moduleResolution.loaders[${extension}] is package-owned; only "empty" is allowed to opt out of imported CSS delivery`,
        );
    }
    for (const [extension, loader] of Object.entries(loaders))
      if (loader === "css")
        throw new Error(
          `moduleResolution.loaders[${extension}] cannot use "css"; rename the stylesheet to .css or use a JavaScript-safe loader`,
        );
    const options = {
      absWorkingDir: path.resolve(
        params.sourceRoot,
        params.configurationDirectory,
      ),
      absPaths: ["metafile", "log"],
      stdin: {
        contents,
        resolveDir: params.sourceRoot,
        sourcefile: path.resolve(params.sourceRoot, "mokly-entry"),
      },
      bundle: true,
      write: false,
      outdir: path.resolve(params.sourceRoot, ".context/sidecar-output"),
      platform: "node",
      format: "cjs",
      target: "node22",
      jsx: "automatic",
      jsxDev: true,
      // Renaming a colliding top-level name would let another module change
      // a function's `name` and its stack frames, outside its render key.
      keepNames: true,
      metafile: true,
      logLevel: "silent",
      ...(resolution.mode === "native"
        ? { logOverride: nativeLogOverride }
        : {}),
      plugins: consumerPlugins(
        params,
        inputs,
        require,
        paths,
        runtimeKey,
        resolution,
      ),
      ...resolutionOptions(params.sourceRoot, settings),
      loader: loaders as Record<string, Loader>,
    } satisfies Parameters<typeof build>[0];
    let compiled: BuildResult<typeof options>;
    try {
      compiled = await measurements.run("sidecar.bundle.compile", () =>
        compile(options),
      );
    } catch (error) {
      if (resolution.mode === "native") return {};
      throw error;
    }
    if (resolution.mode === "native") {
      const { metafile } = compiled;
      const plan = await measurements
        .run("sidecar.bundle.classify", () => planNative(metafile, paths))
        .catch(() => undefined);
      if (!plan) return {};
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
