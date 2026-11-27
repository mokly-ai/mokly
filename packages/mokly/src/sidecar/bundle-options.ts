import path from "node:path";

import type { build, Loader } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { virtualEntry } from "./bundle-entry.js";
import { configuredFiles } from "./configured-files.js";
import type { ModulePaths } from "./module-paths.js";
import { nativeLogOverride } from "./native-resolution.js";
import type { Resolution } from "./native-resolution.js";
import type { ConsumerRequire } from "./paths.js";
import { consumerPlugins } from "./plugins.js";
import type { BundleInputs } from "./plugins.js";
import type { ResolutionEvidence } from "./resolution-evidence.js";
import { resolutionOptions } from "./resolution.js";
import type { ServeEditImports } from "./serve-edit-imports.js";

/** Warnings that can leave the require target unknown until evaluation. */
export const runtimeRequireWarnings = {
  "unsupported-require-call": "warning",
  "indirect-require": "warning",
  "direct-eval": "warning",
} as const;

interface BundleBuild {
  params: BundleParams;
  paths: ModulePaths;
  inputs: BundleInputs;
  require: ConsumerRequire;
  runtimeKey: string;
  resolution: Resolution;
  reads: Map<string, Uint8Array>;
  contents: string;
  preview: string | null | undefined;
  evidence: ResolutionEvidence | undefined;
  editImports: ServeEditImports | undefined;
  resolveFilters: readonly RegExp[] | undefined;
  handledImports: Set<string> | undefined;
}

/** The esbuild options and plugin order shared by each compile attempt. */
export function bundleOptions({
  params,
  paths,
  inputs,
  require,
  runtimeKey,
  resolution,
  reads,
  contents,
  preview,
  evidence,
  editImports,
  resolveFilters,
  handledImports,
}: BundleBuild) {
  const settings = params.moduleResolution;
  if (preview) paths.addConfigured(preview);
  if (evidence) paths.workspaceLookups.recordInto(evidence.physical);
  const loaders = Object.fromEntries(
    Object.entries(settings.loaders).filter(
      ([extension]) => extension !== ".css" && extension !== ".module.css",
    ),
  );
  return {
    absWorkingDir: path.resolve(
      params.sourceRoot,
      params.configurationDirectory,
    ),
    absPaths: ["metafile", "log"],
    stdin: {
      contents,
      resolveDir: params.sourceRoot,
      sourcefile: path.resolve(params.sourceRoot, virtualEntry),
    },
    bundle: true,
    write: false,
    outdir: path.resolve(params.sourceRoot, ".context/sidecar-output"),
    platform: "node",
    format: "cjs",
    target: "node22",
    jsx: "automatic",
    jsxDev: true,
    // Keep function names and stack frames independent of other modules.
    keepNames: true,
    metafile: true,
    logLevel: "silent",
    logOverride: {
      ...(resolution.mode === "native" && nativeLogOverride),
      ...(editImports && runtimeRequireWarnings),
    },
    plugins: [
      configuredFiles(paths, resolution),
      ...(evidence ? [evidence.plugin] : []),
      ...(editImports ? [editImports.plugin] : []),
      ...consumerPlugins(
        params,
        inputs,
        require,
        paths,
        runtimeKey,
        resolution,
        reads,
        resolveFilters,
        handledImports,
      ),
    ],
    ...resolutionOptions(params.sourceRoot, settings),
    loader: loaders as Record<string, Loader>,
  } satisfies Parameters<typeof build>[0];
}
