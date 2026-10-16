import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";
import type { Loader } from "esbuild";

import type { AuthoringRuntime } from "../authoring/runtime.js";
import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { BundleResult } from "../generated/sidecar/BundleResult.js";
import type { CompiledGeneration } from "../generated/sidecar/CompiledGeneration.js";
import type { Definitions } from "../generated/sidecar/Definitions.js";
import type { EntryBinding } from "../generated/sidecar/EntryBinding.js";
import type { Warning } from "../generated/sidecar/Warning.js";

import { bundleDetail } from "./bundle-errors.js";
import { moduleGraph } from "./bundle-graph.js";
import { bundleResult, fileDigest, restore } from "./compiled.js";
import { SidecarError } from "./errors.js";
import { ModulePaths } from "./module-paths.js";
import { logical } from "./path-scope.js";
import { confinedFile, consumerRequire } from "./paths.js";
import { consumerPlugins } from "./plugins.js";
import { resolutionOptions } from "./resolution.js";

export interface Generation {
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

export async function bundle(
  params: BundleParams,
  compile: typeof build = build,
): Promise<{ generation: Generation; result: BundleResult }> {
  try {
    const runtimeKey = `mokly:runtime:${randomBytes(24).toString("hex")}`;
    params = { ...params, sourceRoot: await fs.realpath(params.sourceRoot) };
    const paths = await ModulePaths.create(params);
    const require = await consumerRequire(params, paths);
    const inputs = {
      files: new Map<string, Uint8Array>(),
      cssModules: new Set<string>(),
    };
    const files = [
      ...params.entryFiles,
      ...params.storiesFiles,
      ...(params.renderer ? [params.renderer] : []),
    ];
    const inputPaths = new Map<string, string>();
    for (const file of files)
      inputPaths.set(
        logical(params.sourceRoot, path.resolve(params.sourceRoot, file)),
        await confinedFile(params.sourceRoot, file),
      );
    const previews = ["tsx", "ts", "jsx", "js", "mjs", "cjs"].map(
      (extension) => `.storybook/preview.${extension}`,
    );
    const preview = params.storiesFiles.length
      ? (
          await Promise.all(
            previews.map(
              async (file) =>
                await fs.access(path.resolve(params.sourceRoot, file)).then(
                  () => file,
                  () => null,
                ),
            ),
          )
        ).find(Boolean)
      : null;
    const imports = files.map(
      (file, index) =>
        `import * as m${index} from ${JSON.stringify(path.resolve(params.sourceRoot, file))};`,
    );
    if (preview)
      imports.push(
        `import * as preview from ${JSON.stringify(path.resolve(params.sourceRoot, preview))}; export { preview };`,
      );
    imports.push(
      `export const entries = {${params.entryFiles.map((file, index) => `${JSON.stringify(logical(params.sourceRoot, path.resolve(params.sourceRoot, file)))}:m${index}`).join(",")}};`,
    );
    imports.push(
      `export const stories = {${params.storiesFiles.map((file, index) => `${JSON.stringify(logical(params.sourceRoot, path.resolve(params.sourceRoot, file)))}:m${index + params.entryFiles.length}`).join(",")}};`,
    );
    if (params.renderer)
      imports.push(`export const renderer = m${files.length - 1};`);
    const resolution = params.moduleResolution;
    const loaders = Object.fromEntries(
      Object.entries(resolution.loaders).filter(
        ([extension]) => extension !== ".css" && extension !== ".module.css",
      ),
    );
    for (const extension of [".css", ".module.css"]) {
      const value = resolution.loaders[extension];
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
        contents: imports.join("\n"),
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
      metafile: true,
      logLevel: "silent",
      plugins: consumerPlugins(params, inputs, require, paths, runtimeKey),
      ...resolutionOptions(params.sourceRoot, resolution),
      loader: loaders as Record<string, Loader>,
    } satisfies Parameters<typeof build>[0];
    const compiled = await compile(options);
    const { modules: graph, physical } = moduleGraph(compiled.metafile!, paths);
    const hash = createHash("sha256");
    const physicalInputs: Record<string, string | null> = {};
    const metadataInputs: Record<string, string | null> = {};
    for (const module of graph) {
      const absolute = physical.get(module.path)!;
      const text = inputs.files.get(absolute) ?? (await fs.readFile(absolute));
      module.digest = createHash("sha256").update(text).digest("hex");
      hash.update(JSON.stringify([module.path, module.imports]));
      if (!module.path.endsWith(".css")) {
        hash.update(text);
        physicalInputs[absolute] = module.digest;
      }
    }
    for (const file of params.storiesFiles.length ? previews : []) {
      const absolute = path.resolve(params.sourceRoot, file);
      metadataInputs[file] = physicalInputs[absolute] =
        await fileDigest(absolute);
    }
    for (const root of paths.dependencyRoots) {
      const file = path.join(root, "react/package.json");
      metadataInputs[paths.name(file)] = physicalInputs[file] =
        await fileDigest(file);
    }
    let reactVersion: string | null = null;
    try {
      const file = require.resolve("react/package.json");
      const bytes = await fs.readFile(file);
      reactVersion = JSON.parse(bytes.toString()).version;
      metadataInputs[paths.name(file)] = physicalInputs[file] = createHash(
        "sha256",
      )
        .update(bytes)
        .digest("hex");
    } catch (error) {
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "MODULE_NOT_FOUND"
      ))
        throw error;
    }
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
      peers: require.snapshot(),
      modules: graph,
      inputs: physicalInputs,
      metadataInputs,
    };
    const generation = restore(params, compilation);
    return { generation, result: bundleResult(generation) };
  } catch (error) {
    throw new SidecarError(
      "bundle-failed",
      bundleDetail(error, params.sourceRoot),
    );
  }
}
