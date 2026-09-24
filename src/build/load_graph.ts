import path from "node:path";

import { build } from "esbuild";

import type { RegistryDefinition } from "../authoring/types.js";
import type { CompatibilityTransformer } from "../compatibility/types.js";
import type { ComponentGraphRenderer } from "../components/render.js";
import { discoverEntryModules } from "../config/entry_discovery.js";
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
import type { GeneratedFile } from "./generated_file.js";
import { assertSafeGeneratedTree } from "./reserved_tree.js";
import { graphSourceFiles, normalizeSourceFiles } from "./source_inventory.js";
import { bundleStyles } from "./styles/bundle.js";
import { GraphStyles } from "./styles/collect.js";
import { orderedStyles } from "./styles/order.js";
import { StylePreprocessor } from "./styles/preprocess.js";
import { inventoryTransformerStyles } from "./styles/transformer_inventory.js";

/** Consumer modules loaded in one React-safe esbuild graph. */
export interface LoadedGraph {
  compatibilityTransformer?: CompatibilityTransformer;
  definitions: unknown[];
  entrySources: readonly string[];
  sourceFiles: readonly string[];
  renderer: Renderer;
  renderWithComponents: ComponentGraphRenderer;
  /** Per-root generated CSS routes (renderer and entries only). */
  stylesheetRoutes: ReadonlyMap<string, string>;
  /** CSS text and opaque assets for this compilation. */
  styleOutputs: ReadonlyMap<string, GeneratedFile>;
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
  assertSafeGeneratedTree(config);
  const entrySources = timeSync("graph.discover", () =>
    discoverEntryModules(config),
  );
  config = { ...config, entryModules: entrySources };
  timingCounts("graph", () => ({ entryModules: entrySources.length }));
  const outputPath = path.join(
    path.dirname(config.configPath),
    ".mokly-consumer.cjs",
  );
  const styles = new GraphStyles(config, new StylePreprocessor(config));
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
        loader: {
          ...config.moduleResolution.loaders,
          ...(config.moduleResolution.loaders[".css"] === "empty"
            ? { ".module.css": "empty" as const }
            : {}),
        },
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
          styles.plugin,
        ],
        ...(config.moduleResolution.resolveExtensions
          ? {
              resolveExtensions: [...config.moduleResolution.resolveExtensions],
            }
          : {}),
        target: "node22",
      }),
    );
    const extraOutputs = built.outputFiles!.filter(
      (file) => file.path !== outputPath,
    );
    if (extraOutputs.length)
      throw new MoklyError(
        "build-invalid",
        `consumer graph emitted an undelivered file: ${path.relative(config.repoRoot, extraOutputs[0]!.path).split(path.sep).join("/")}; use a dataurl or binary loader for JavaScript assets instead of file`,
      );
    const graphFiles = graphSourceFiles(
      built.metafile,
      path.dirname(config.configPath),
      config.repoRoot,
      config.mockupsDir,
    );
    const roots = [
      ...(config.renderer ? [{ path: config.renderer, emit: true }] : []),
      ...entrySources.map((entry) => ({ path: entry, emit: true })),
      ...(config.compatibility.transformer
        ? [{ path: config.compatibility.transformer, emit: false }]
        : []),
    ].map((root) => ({
      ...root,
      styles: orderedStyles(
        built.metafile,
        root.path,
        path.dirname(config.configPath),
      ).filter(
        (file) =>
          config.moduleResolution.loaders[".css"] !== "empty" &&
          (!file.endsWith(".module.css") ||
            config.moduleResolution.loaders[".module.css"] !== "empty"),
      ),
    }));
    const deliveryRoots = roots.filter((root) => root.emit);
    const transformerStyles = roots.find((root) => !root.emit)?.styles ?? [];
    const graphInputs = new Set(
      graphFiles.map((file) => path.resolve(config.repoRoot, file)),
    );
    const bundled = deliveryRoots.some((root) => root.styles.length)
      ? await bundleStyles(
          config,
          deliveryRoots,
          graphInputs,
          styles.preprocessor,
        )
      : {
          outputs: new Map<string, GeneratedFile>(),
          routes: new Map<string, string>(),
          sourceFiles: new Set<string>(),
        };
    const transformerFiles = await inventoryTransformerStyles(
      config,
      transformerStyles,
      graphInputs,
      styles.preprocessor,
    );
    const sourceFiles = normalizeSourceFiles(
      [
        ...graphFiles,
        ...bundled.sourceFiles,
        ...transformerFiles,
        ...styles.preprocessor.sourceFiles,
        ...(config.configSourceFiles ?? [config.configPath]),
        ...entrySources,
        ...(config.renderer ? [config.renderer] : []),
        ...(config.compatibility.transformer
          ? [config.compatibility.transformer]
          : []),
      ],
      config.repoRoot,
      config.mockupsDir,
    );
    if (!evaluate)
      return {
        definitions: [],
        entrySources,
        sourceFiles,
        stylesheetRoutes: bundled.routes,
        styleOutputs: bundled.outputs,
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
      stylesheetRoutes: bundled.routes,
      styleOutputs: bundled.outputs,
      renderer: imported.renderer as Renderer,
      renderWithComponents: imported.renderWithComponents,
    };
    rememberBundle(graph, bundle);
    return graph;
  } catch (error) {
    if (styles.failure) throw styles.failure;
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
