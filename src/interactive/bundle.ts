import { builtinModules } from "node:module";
import path from "node:path";

import {
  context,
  type BuildContext,
  type Plugin,
  type PluginBuild,
} from "esbuild";

import {
  interactiveConsumerPlugin,
  packageApiPlugin,
  runtimeModule,
} from "../build/consumer_entry.js";
import {
  consumerReactPlugin,
  packageNodePaths,
} from "../build/consumer_resolution.js";
import type { InteractiveSourceCapture } from "../build/interactive_source_capture.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { errorMessage, MoklyError } from "../errors.js";

import {
  CAPTURED_SOURCE_NAMESPACE,
  interactiveSourceResolver,
} from "./source_resolution.js";

/** Immutable ESM bytes for one catalogue generation. */
export interface InteractiveBundle {
  code: string;
  generation: string;
}

/** Inputs required to compile the consumer graph for one generation. */
export interface InteractiveBundleRequest {
  config: ResolvedConfig;
  generation: string;
  sources: InteractiveSourceCapture;
}

/** Generation-keyed bundle service consumed by the interactive origin. */
export interface InteractiveBundler {
  build(request: InteractiveBundleRequest): Promise<InteractiveBundle>;
  invalidate(generation: string): void;
}

/** Injected browser compiler boundary used by the retained generation cache. */
export interface InteractiveBundleCompiler {
  compile(request: {
    config: ResolvedConfig;
    signal: AbortSignal;
    sources: InteractiveSourceCapture;
  }): Promise<string>;
}

interface CachedBundle {
  controller: AbortController;
  promise: Promise<InteractiveBundle>;
}

/** Retain the current and previous generation, coalescing concurrent builds. */
export class CachedInteractiveBundler implements InteractiveBundler {
  private readonly generations = new Map<string, CachedBundle>();

  constructor(private readonly compiler: InteractiveBundleCompiler) {}

  build(request: InteractiveBundleRequest): Promise<InteractiveBundle> {
    const cached = this.generations.get(request.generation);
    if (cached) return cached.promise;
    const controller = new AbortController();
    const promise = this.compiler
      .compile({
        config: request.config,
        signal: controller.signal,
        sources: request.sources,
      })
      .then((code) => ({ code, generation: request.generation }));
    this.generations.set(request.generation, { controller, promise });
    while (this.generations.size > 2) {
      const oldest = this.generations.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.invalidate(oldest);
    }
    return promise;
  }

  invalidate(generation: string): void {
    const cached = this.generations.get(generation);
    if (!cached) return;
    this.generations.delete(generation);
    cached.controller.abort();
  }
}

/** esbuild implementation of the package's browser consumer graph. */
export class EsbuildInteractiveBundleCompiler implements InteractiveBundleCompiler {
  async compile(request: {
    config: ResolvedConfig;
    signal: AbortSignal;
    sources: InteractiveSourceCapture;
  }): Promise<string> {
    const { config, signal, sources } = request;
    const entrySources = config.entryModules;
    if (!entrySources)
      throw new MoklyError(
        "interactive-bundle",
        "accepted Live runtime is missing its entry modules",
      );
    const outputPath = path.join(
      path.dirname(config.configPath),
      ".mokly-interactive.js",
    );
    const guard = nodeBuiltinGuard(config);
    const sourceResolver = interactiveSourceResolver(config, sources);
    let buildContext: BuildContext | undefined;
    const cancel = (): void => {
      if (buildContext) void buildContext.cancel();
    };
    try {
      if (signal.aborted)
        throw new Error("Live bundle compilation was cancelled");
      buildContext = await context({
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
          interactiveConsumerPlugin(config, entrySources),
          packageApiPlugin(config, {
            isRepositoryImporter: (_importer, namespace) =>
              namespace === CAPTURED_SOURCE_NAMESPACE,
          }),
          consumerReactPlugin(config, { browser: true }),
          sourceResolver.plugin,
          guard.plugin,
        ],
        ...(config.moduleResolution.resolveExtensions
          ? {
              resolveExtensions: [...config.moduleResolution.resolveExtensions],
            }
          : {}),
        target: "es2023",
      });
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) await buildContext.cancel();
      const result = await buildContext.rebuild();
      if (signal.aborted)
        throw new Error("Live bundle compilation was cancelled");
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
      if (signal.aborted) throw error;
      const sourceFailure = sourceResolver.failure();
      if (sourceFailure) throw sourceFailure;
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
    } finally {
      signal.removeEventListener("abort", cancel);
      if (buildContext) await buildContext.dispose();
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
