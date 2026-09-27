import { builtinModules } from "node:module";
import path from "node:path";

import { build, type Plugin, type PluginBuild } from "esbuild";

import {
  interactiveConsumerPlugin,
  packageApiPlugin,
  runtimeModule,
} from "../build/consumer_entry.js";
import {
  consumerReactPlugin,
  packageNodePaths,
} from "../build/consumer_resolution.js";
import { discoverEntryModules } from "../config/entry_discovery.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { errorMessage, MoklyError } from "../errors.js";

/** Immutable ESM bytes for one catalogue generation. */
export interface InteractiveBundle {
  code: string;
  generation: string;
}

/** Inputs required to compile the consumer graph for one generation. */
export interface InteractiveBundleRequest {
  config: ResolvedConfig;
  generation: string;
}

/** Generation-keyed bundle service consumed by the interactive origin. */
export interface InteractiveBundler {
  build(request: InteractiveBundleRequest): Promise<InteractiveBundle>;
  invalidate(generation: string): void;
}

/** Injected browser compiler boundary used by the retained generation cache. */
export interface InteractiveBundleCompiler {
  compile(config: ResolvedConfig): Promise<string>;
}

/** Retain the current and previous generation, coalescing concurrent builds. */
export class CachedInteractiveBundler implements InteractiveBundler {
  private readonly generations = new Map<string, Promise<InteractiveBundle>>();

  constructor(private readonly compiler: InteractiveBundleCompiler) {}

  build(request: InteractiveBundleRequest): Promise<InteractiveBundle> {
    const cached = this.generations.get(request.generation);
    if (cached) return cached;
    const pending = this.compiler.compile(request.config).then((code) => ({
      code,
      generation: request.generation,
    }));
    this.generations.set(request.generation, pending);
    while (this.generations.size > 2) {
      const oldest = this.generations.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.generations.delete(oldest);
    }
    return pending;
  }

  invalidate(generation: string): void {
    this.generations.delete(generation);
  }
}

/** esbuild implementation of the package's browser consumer graph. */
export class EsbuildInteractiveBundleCompiler implements InteractiveBundleCompiler {
  async compile(config: ResolvedConfig): Promise<string> {
    const entrySources = discoverEntryModules(config);
    const resolved = { ...config, entryModules: entrySources };
    const outputPath = path.join(
      path.dirname(config.configPath),
      ".mokly-interactive.js",
    );
    const guard = nodeBuiltinGuard(config);
    try {
      const result = await build({
        write: false,
        preserveSymlinks: true,
        absWorkingDir: path.dirname(config.configPath),
        alias: config.moduleResolution.aliases,
        bundle: true,
        ...(config.moduleResolution.conditions
          ? { conditions: [...config.moduleResolution.conditions] }
          : {}),
        entryPoints: [
          runtimeModule(
            "../interactive/runtime/entry.js",
            "../interactive/runtime/entry.ts",
          ),
        ],
        format: "esm",
        jsx: "automatic",
        jsxDev: true,
        loader: config.moduleResolution.loaders,
        logLevel: "silent",
        ...(config.moduleResolution.mainFields
          ? { mainFields: [...config.moduleResolution.mainFields] }
          : {}),
        nodePaths: packageNodePaths(config),
        outfile: outputPath,
        platform: "browser",
        plugins: [
          interactiveConsumerPlugin(resolved, entrySources),
          packageApiPlugin(resolved),
          consumerReactPlugin(resolved, { browser: true }),
          guard.plugin,
        ],
        ...(config.moduleResolution.resolveExtensions
          ? {
              resolveExtensions: [...config.moduleResolution.resolveExtensions],
            }
          : {}),
        target: "es2023",
      });
      const output = result.outputFiles?.find(
        (candidate) => candidate.path === outputPath,
      );
      if (!output)
        throw new MoklyError(
          "interactive-bundle",
          "esbuild did not emit the Live browser bundle",
        );
      return output.text;
    } catch (error) {
      if (error instanceof MoklyError) throw error;
      const nodeImport = guard.failure();
      if (nodeImport)
        throw new MoklyError(
          "interactive-bundle",
          `${nodeImport.importer} imports Node-only module ${nodeImport.specifier}`,
          { cause: error },
        );
      throw new MoklyError(
        "interactive-bundle",
        `could not bundle consumer modules for Live: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
}

interface NodeImportFailure {
  importer: string;
  specifier: string;
}

function nodeBuiltinGuard(config: ResolvedConfig): {
  failure(): NodeImportFailure | undefined;
  plugin: Plugin;
} {
  const builtins = new Set(
    builtinModules.flatMap((name) => [name, `node:${name}`]),
  );
  let failure: NodeImportFailure | undefined;
  return {
    failure: () => failure,
    plugin: {
      name: "mokly-browser-node-builtins",
      setup(pluginBuild: PluginBuild): void {
        pluginBuild.onResolve({ filter: /.*/ }, (arguments_) => {
          if (!builtins.has(arguments_.path)) return;
          const importer = arguments_.importer
            ? moduleLabel(arguments_.importer, config.repoRoot)
            : "<browser entry>";
          failure ??= { importer, specifier: arguments_.path };
          return {
            errors: [
              {
                text: `${importer} imports Node-only module ${arguments_.path}`,
              },
            ],
          };
        });
      },
    },
  };
}

function moduleLabel(importer: string, repoRoot: string): string {
  const relative = path.relative(repoRoot, importer);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? toPosixPath(relative)
    : importer;
}
