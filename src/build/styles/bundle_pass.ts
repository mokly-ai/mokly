import fs from "node:fs/promises";
import path from "node:path";

import { build, type BuildFailure, type Metafile, type Plugin } from "esbuild";

import { toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError, errorMessage } from "../../errors.js";
import { packageNodePaths } from "../consumer_resolution.js";
import type { GeneratedFile } from "../generated_file.js";
import { metafileKey, metafilePath } from "../metafile_paths.js";
import { graphSourceFiles } from "../source_inventory.js";

import { stripSourcePathComments } from "./outputs.js";
import { scanImportPrelude } from "./prelude.js";
import type { StylePreprocessor } from "./preprocess.js";
import { StyleResolution } from "./resolution.js";
import { ASSET_EXTENSIONS } from "./routes.js";

/** One root with a unique virtual stylesheet entry and public output route. */
export interface StyleRoot {
  readonly path: string;
  readonly route: string;
  readonly direct: readonly string[];
}

/** Outputs, prelude closure, CSS-pass inputs and assets from one esbuild invocation. */
export interface StylePass {
  readonly outputs: ReadonlyMap<string, GeneratedFile>;
  readonly closures: ReadonlyMap<string, ReadonlySet<string>>;
  readonly inputs: ReadonlyMap<string, readonly string[]>;
  readonly assets: ReadonlySet<string>;
}

/** Process all roots sharing an exclusion set in a single multi-entry build. */
export async function bundleStylePass(
  config: ResolvedConfig,
  roots: readonly StyleRoot[],
  excluded: ReadonlySet<string>,
  graphInputs: ReadonlySet<string>,
  preprocessor: StylePreprocessor,
): Promise<StylePass> {
  const resolution = new StyleResolution(config, graphInputs);
  const closures = new Map(roots.map((root) => [root.path, new Set<string>()]));
  const virtual = roots.map((_, index) => `mokly:styles:${index}`);
  const pluginFailures = new Map<string, MoklyError>();
  const plugin: Plugin = {
    name: "mokly-style-entry",
    setup(pluginBuild) {
      const resolveImport = (specifier: string, importer: string) =>
        resolution.resolveImport(pluginBuild, specifier, importer);
      const visit = async (
        file: string,
        closure: Set<string>,
      ): Promise<void> => {
        if (closure.has(file)) return;
        closure.add(file);
        const content = await fs.readFile(file, "utf8");
        for (const entry of scanImportPrelude(content)) {
          const resolved = await resolveImport(entry.specifier, file);
          if (resolved) await visit(resolved, closure);
        }
      };
      pluginBuild.onResolve({ filter: /^mokly:styles:\d+$/ }, (arguments_) => ({
        path: arguments_.path,
        namespace: "mokly-styles",
      }));
      pluginBuild.onLoad(
        { filter: /.*/, namespace: "mokly-styles" },
        async (arguments_) => {
          const root = roots[virtual.indexOf(arguments_.path)];
          if (!root) return;
          try {
            const closure = closures.get(root.path)!;
            for (const file of root.direct) await visit(file, closure);
            return {
              contents: root.direct
                .map((file) => `@import ${JSON.stringify(file)};`)
                .join("\n"),
              loader: "css",
              resolveDir: config.repoRoot,
            };
          } catch (error) {
            const failure = asBuildError(error);
            pluginFailures.set(arguments_.path, failure);
            return { errors: [{ text: failure.message }] };
          }
        },
      );
      pluginBuild.onLoad({ filter: /\.css$/ }, async (arguments_) => {
        try {
          const prepared = await preprocessor.prepare(
            arguments_.path,
            excluded,
            resolveImport,
          );
          return {
            contents: prepared.css,
            loader: "css",
            resolveDir: path.dirname(arguments_.path),
          };
        } catch (error) {
          const failure = asBuildError(error);
          pluginFailures.set(arguments_.path, failure);
          return { errors: [{ text: failure.message }] };
        }
      });
    },
  };

  let metafile: Metafile;
  const outputs = new Map<string, GeneratedFile>();
  try {
    const built = await build({
      absWorkingDir: config.repoRoot,
      alias: config.moduleResolution.aliases,
      assetNames: "../assets/[dir]/[name]",
      bundle: true,
      conditions: ["style", ...(config.moduleResolution.conditions ?? [])],
      entryPoints: roots.map((root, index) => ({
        in: virtual[index]!,
        out: toPosixPath(path.relative(config.repoRoot, root.path)),
      })),
      loader: Object.fromEntries(
        [...ASSET_EXTENSIONS].map((ext) => [ext, "file" as const]),
      ),
      logLevel: "silent",
      mainFields: [
        "style",
        ...(config.moduleResolution.mainFields ?? ["main", "module"]),
      ],
      metafile: true,
      minify: false,
      nodePaths: packageNodePaths(config),
      outbase: config.repoRoot,
      outdir: path.join(config.mockupsDir, "mokly-generated/styles"),
      platform: "node",
      plugins: [plugin, resolution.plugin],
      preserveSymlinks: true,
      ...(config.moduleResolution.resolveExtensions
        ? { resolveExtensions: [...config.moduleResolution.resolveExtensions] }
        : {}),
      target: "esnext",
      write: false,
    });
    metafile = built.metafile!;
    for (const file of built.outputFiles ?? []) {
      const route = toPosixPath(path.relative(config.mockupsDir, file.path));
      outputs.set(
        route,
        route.endsWith(".css")
          ? stripSourcePathComments(file.text, metafile)
          : file.contents,
      );
    }
  } catch (error) {
    for (const [index, root] of roots.entries()) {
      const closure = closures.get(root.path)!;
      for (const file of [virtual[index]!, ...[...closure].sort()]) {
        const failure =
          pluginFailures.get(file) ?? resolution.failures.get(file);
        if (failure) throw failure;
      }
    }
    if (error instanceof MoklyError) throw error;
    const failure = error as BuildFailure;
    const ranked = [...(failure.errors ?? [])].sort(
      (first, second) =>
        rootIndex(first.location?.file, roots, closures, config) -
        rootIndex(second.location?.file, roots, closures, config),
    );
    const root =
      roots[rootIndex(ranked[0]?.location?.file, roots, closures, config)]!;
    throw new MoklyError(
      "build-invalid",
      `could not bundle CSS ${toPosixPath(path.relative(config.repoRoot, root.path))}: ${ranked[0]?.text ?? errorMessage(error)}; fix the stylesheet and rebuild`,
      { cause: error },
    );
  }

  const inputs = new Map<string, readonly string[]>();
  for (const root of roots) {
    const output = metafileKey(
      config.repoRoot,
      path.join(config.mockupsDir, root.route),
    );
    const cssInputs = metafile.outputs[output]?.inputs ?? {};
    const rootMetafile: Metafile = {
      inputs: Object.fromEntries(
        Object.keys(cssInputs).flatMap((file) =>
          metafile.inputs[file] ? [[file, metafile.inputs[file]]] : [],
        ),
      ),
      outputs: {},
    };
    inputs.set(
      root.path,
      graphSourceFiles(
        rootMetafile,
        config.repoRoot,
        config.repoRoot,
        config.mockupsDir,
      ).map((file) => path.join(config.repoRoot, file)),
    );
  }
  return { outputs, closures, inputs, assets: resolution.assets };
}

function asBuildError(error: unknown): MoklyError {
  return error instanceof MoklyError
    ? error
    : new MoklyError("build-invalid", errorMessage(error));
}

function rootIndex(
  source: string | undefined,
  roots: readonly StyleRoot[],
  closures: ReadonlyMap<string, ReadonlySet<string>>,
  config: ResolvedConfig,
): number {
  const virtual = source && /^mokly-styles:mokly:styles:(\d+)$/.exec(source);
  if (virtual) return Number(virtual[1]);
  const absolute = source && metafilePath(config.repoRoot, source);
  const index = roots.findIndex(
    (root) => absolute && closures.get(root.path)?.has(absolute),
  );
  return index < 0 ? 0 : index;
}
