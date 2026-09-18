import path from "node:path";

import { build } from "esbuild";

import type { RegistryDefinition } from "../authoring/types.js";
import type { CompatibilityTransformer } from "../compatibility/types.js";
import type { ComponentGraphRenderer } from "../components/render.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync, timingCounts } from "../diagnostics/timings.js";
import { MoklyError, errorMessage } from "../errors.js";
import type { Renderer } from "../renderer/types.js";

import { evaluateBundle, rememberBundle } from "./consumer_bundle.js";
import {
  CONSUMER_ENTRY_PATH,
  consumerEntryPlugin,
  packageApiPlugin,
} from "./consumer_entry.js";
import {
  consumerReactPlugin,
  packageNodePaths,
} from "./consumer_resolution.js";
import { discoverEntryModules } from "./discovery.js";
import { graphSourceFiles, normalizeSourceFiles } from "./source_inventory.js";

/** Consumer modules loaded in one React-safe esbuild graph. */
export interface LoadedGraph {
  compatibilityTransformer?: CompatibilityTransformer;
  definitions: unknown[];
  entrySources: readonly string[];
  sourceFiles: readonly string[];
  renderer: Renderer;
  renderWithComponents: ComponentGraphRenderer;
}

/** Bundle and import all React-bearing consumer modules as one graph. */
export async function loadConsumerGraph(
  config: ResolvedConfig,
  evaluate = true,
): Promise<LoadedGraph> {
  return timeAsync(evaluate ? "graph.load" : "graph.inventory", () =>
    loadGraph(config, evaluate),
  );
}

async function loadGraph(
  config: ResolvedConfig,
  evaluate: boolean,
): Promise<LoadedGraph> {
  const entrySources = timeSync("graph.discover", () =>
    discoverEntryModules(config.entriesDir),
  );
  timingCounts("graph", () => ({ entryModules: entrySources.length }));
  const outputPath = path.join(
    path.dirname(config.configPath),
    ".mokly-consumer.cjs",
  );
  try {
    const built = await timeAsync("graph.bundle", () =>
      build({
        write: false,
        metafile: true,
        preserveSymlinks: true,
        absWorkingDir: path.dirname(config.configPath),
        alias: config.moduleResolution.aliases,
        bundle: true,
        ...(config.moduleResolution.conditions
          ? { conditions: [...config.moduleResolution.conditions] }
          : {}),
        entryPoints: [CONSUMER_ENTRY_PATH],
        format: "cjs",
        jsx: "automatic",
        jsxDev: true,
        loader: config.moduleResolution.loaders,
        logLevel: "silent",
        ...(config.moduleResolution.mainFields
          ? { mainFields: [...config.moduleResolution.mainFields] }
          : {}),
        nodePaths: packageNodePaths(config),
        outfile: outputPath,
        platform: "node",
        plugins: [
          consumerEntryPlugin(config, entrySources),
          packageApiPlugin(config),
          consumerReactPlugin(config),
        ],
        ...(config.moduleResolution.resolveExtensions
          ? {
              resolveExtensions: [...config.moduleResolution.resolveExtensions],
            }
          : {}),
        target: "node22",
      }),
    );
    const sourceFiles = normalizeSourceFiles(
      [
        ...graphSourceFiles(
          built.metafile,
          path.dirname(config.configPath),
          config.repoRoot,
        ),
        ...(config.configSourceFiles ?? [config.configPath]),
        ...entrySources,
        ...(config.renderer ? [config.renderer] : []),
        ...(config.compatibility.transformer
          ? [config.compatibility.transformer]
          : []),
      ],
      config.repoRoot,
    );
    if (!evaluate)
      return {
        definitions: [],
        entrySources,
        sourceFiles,
        renderWithComponents: () => {
          throw new Error("inventory-only graph cannot render");
        },
        renderer: () => {
          throw new Error("inventory-only graph cannot render");
        },
      };
    const bundle = {
      code: built.outputFiles!.find((file) => file.path === outputPath)!.text,
      filename: outputPath,
      entrySources,
    };
    const imported = timeSync("graph.evaluate", () => evaluateBundle(bundle));
    timingCounts("graph.bundle", () => ({
      bytes: Buffer.byteLength(bundle.code),
      sourceFiles: sourceFiles.length,
    }));
    if (typeof imported.renderer !== "function") {
      throw new MoklyError(
        "build-invalid",
        "renderer module must default-export a function",
      );
    }
    if (
      config.compatibility.transformer &&
      typeof imported.compatibilityTransformer !== "function"
    ) {
      throw new MoklyError(
        "build-invalid",
        "compatibility transformer module must default-export a function",
      );
    }
    const graph: LoadedGraph = {
      ...(typeof imported.compatibilityTransformer === "function"
        ? {
            compatibilityTransformer:
              imported.compatibilityTransformer as CompatibilityTransformer,
          }
        : {}),
      definitions: imported.definitions,
      entrySources,
      sourceFiles,
      renderer: imported.renderer as Renderer,
      renderWithComponents: imported.renderWithComponents,
    };
    rememberBundle(graph, bundle);
    return graph;
  } catch (error) {
    if (error instanceof MoklyError) throw error;
    throw new MoklyError(
      "build-invalid",
      `could not bundle consumer modules: ${errorMessage(error)}`,
      {
        cause: error,
      },
    );
  }
}

/** Narrow an unknown loaded value after runtime validation. */
export function asRegistryDefinition(
  value: unknown,
): RegistryDefinition | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RegistryDefinition)
    : undefined;
}
