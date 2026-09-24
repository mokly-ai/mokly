import fs from "node:fs/promises";
import path from "node:path";

import { build, type Metafile, type Plugin } from "esbuild";

import { isInside, toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { timeAsync } from "../../diagnostics/timings.js";
import { MoklyError, errorMessage } from "../../errors.js";
import { packageNodePaths } from "../consumer_resolution.js";
import type { GeneratedFile } from "../generated_file.js";
import { graphSourceFiles } from "../source_inventory.js";

import { acceptStyleOutput, stripSourcePathComments } from "./outputs.js";
import { scanImportPrelude } from "./prelude.js";
import type { StylePreprocessor } from "./preprocess.js";
import { StyleResolution } from "./resolution.js";
import { ASSET_EXTENSIONS, stylesheetRoute } from "./routes.js";

/** CSS outputs and private dependencies from all delivery roots. */
export interface BundledStyles {
  readonly outputs: ReadonlyMap<string, GeneratedFile>;
  readonly routes: ReadonlyMap<string, string>;
  readonly sourceFiles: ReadonlySet<string>;
}

/** Bundle renderer first, then entries; transformer-only CSS is analyzed separately. */
export async function bundleStyles(
  config: ResolvedConfig,
  roots: readonly {
    readonly path: string;
    readonly styles: readonly string[];
  }[],
  graphInputs: ReadonlySet<string>,
  preprocessor: StylePreprocessor,
): Promise<BundledStyles> {
  const outputs = new Map<string, GeneratedFile>();
  const routes = new Map<string, string>();
  const sourceFiles = new Set<string>();
  const rendererFiles = new Set<string>();
  for (const root of roots) {
    if (!root.styles.length) continue;
    if (routes.has(root.path)) {
      const route = stylesheetRoute(root.path, config.repoRoot);
      throw new MoklyError(
        "build-invalid",
        `generated route collision: ${route}; give each entry root a distinct repository path`,
      );
    }
    const excluded =
      config.renderer && root.path !== config.renderer
        ? rendererFiles
        : new Set<string>();
    const direct = root.styles.filter((file) => !excluded.has(file));
    if (!direct.length) continue;
    const route = stylesheetRoute(root.path, config.repoRoot);
    const result = await timeAsync("styles.bundle", () =>
      bundleRoot(
        config,
        root.path,
        direct,
        excluded,
        graphInputs,
        preprocessor,
      ),
    );
    if (root.path === config.renderer)
      for (const file of result.closure) rendererFiles.add(file);
    for (const file of [
      ...result.closure,
      ...result.assets,
      ...result.inputs,
    ]) {
      if (
        isInside(config.repoRoot, file) &&
        !path
          .relative(config.repoRoot, file)
          .split(path.sep)
          .includes("node_modules")
      )
        sourceFiles.add(file);
    }
    if (result.css !== undefined) {
      routes.set(root.path, route);
      for (const [outputRoute, contents] of result.outputs) {
        acceptStyleOutput(outputs, outputRoute, contents);
      }
    }
  }
  return { outputs, routes, sourceFiles };
}

interface RootResult {
  readonly closure: ReadonlySet<string>;
  readonly assets: ReadonlySet<string>;
  readonly inputs: readonly string[];
  readonly outputs: ReadonlyMap<string, GeneratedFile>;
  readonly css?: string;
}

async function bundleRoot(
  config: ResolvedConfig,
  root: string,
  direct: readonly string[],
  excluded: ReadonlySet<string>,
  graphInputs: ReadonlySet<string>,
  preprocessor: StylePreprocessor,
): Promise<RootResult> {
  const resolution = new StyleResolution(config, graphInputs);
  const closure = new Set<string>();
  let pluginFailure: MoklyError | undefined;
  const input = "mokly:styles";
  const plugin: Plugin = {
    name: "mokly-style-entry",
    setup(pluginBuild) {
      const resolveImport = (specifier: string, importer: string) =>
        resolution.resolveImport(pluginBuild, specifier, importer);
      const visit = async (file: string): Promise<void> => {
        if (closure.has(file)) return;
        closure.add(file);
        const content = await fs.readFile(file, "utf8");
        for (const entry of scanImportPrelude(content)) {
          const resolved = await resolveImport(entry.specifier, file);
          if (resolved) await visit(resolved);
        }
      };
      pluginBuild.onResolve({ filter: /^mokly:styles$/ }, () => ({
        path: input,
        namespace: "mokly-styles",
      }));
      pluginBuild.onLoad(
        { filter: /.*/, namespace: "mokly-styles" },
        async () => {
          try {
            for (const file of direct) await visit(file);
            return {
              contents: direct
                .map((file) => `@import ${JSON.stringify(file)};`)
                .join("\n"),
              loader: "css",
              resolveDir: config.repoRoot,
            };
          } catch (error) {
            pluginFailure =
              error instanceof MoklyError
                ? error
                : new MoklyError("build-invalid", errorMessage(error));
            return { errors: [{ text: pluginFailure.message }] };
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
          pluginFailure =
            error instanceof MoklyError
              ? error
              : new MoklyError("build-invalid", errorMessage(error));
          return { errors: [{ text: pluginFailure.message }] };
        }
      });
    },
  };
  let metafile: Metafile;
  const outputs = new Map<string, GeneratedFile>();
  let css: string | undefined;
  try {
    const built = await build({
      absWorkingDir: config.repoRoot,
      alias: config.moduleResolution.aliases,
      assetNames: "../assets/[dir]/[name]",
      bundle: true,
      conditions: ["style", ...(config.moduleResolution.conditions ?? [])],
      entryPoints: [
        { in: input, out: toPosixPath(path.relative(config.repoRoot, root)) },
      ],
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
      if (route.endsWith(".css")) {
        css = stripSourcePathComments(file.text, metafile);
        outputs.set(route, css);
      } else outputs.set(route, file.contents);
    }
  } catch (error) {
    if (pluginFailure || resolution.failure)
      throw pluginFailure ?? resolution.failure;
    if (error instanceof MoklyError) throw error;
    throw new MoklyError(
      "build-invalid",
      `could not bundle CSS ${toPosixPath(path.relative(config.repoRoot, root))}: ${errorMessage(error)}; fix the stylesheet and rebuild`,
      { cause: error },
    );
  }
  return {
    closure,
    assets: resolution.assets,
    inputs: graphSourceFiles(
      metafile,
      config.repoRoot,
      config.repoRoot,
      config.mockupsDir,
    ).map((relative) => path.join(config.repoRoot, relative)),
    outputs,
    ...(css === undefined ? {} : { css }),
  };
}
