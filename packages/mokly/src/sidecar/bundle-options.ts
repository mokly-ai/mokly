import path from "node:path";

import type { build, Loader } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

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
  resolveFilter: RegExp | undefined;
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
  resolveFilter,
}: BundleBuild) {
  const settings = params.moduleResolution;
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
    // Keep function names and stack frames independent of other modules.
    keepNames: true,
    metafile: true,
    logLevel: "silent",
    ...(resolution.mode === "native" ? { logOverride: nativeLogOverride } : {}),
    plugins: [
      configuredFiles(params, paths, preview, resolution),
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
        resolveFilter,
      ),
    ],
    ...resolutionOptions(params.sourceRoot, settings),
    loader: loaders as Record<string, Loader>,
  } satisfies Parameters<typeof build>[0];
}
