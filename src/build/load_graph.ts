import path from "node:path";

import { build } from "esbuild";

import type { ComponentGraphRenderer } from "../components/render.js";
import {
  discoverEntries,
  type EntryDiscovery,
} from "../config/entry_discovery.js";
import {
  FileSystemPostcssConfigLoader,
  type PostcssConfigLoader,
} from "../config/postcss_loader.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync, timingCounts } from "../diagnostics/timings.js";
import { loadDocuments, type ResolvedDocument } from "../documents/load.js";
import { MoklyError, errorMessage, isMoklyError } from "../errors.js";
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
import { createMetafilePathMapper } from "./metafile_paths.js";
import { graphSourceFiles, normalizeSourceFiles } from "./source_inventory.js";
import { bundleStyles } from "./styles/bundle.js";
import { GraphStyles } from "./styles/collect.js";
import { collectPostcssDependencies } from "./styles/dependency_inventory.js";
import { createStyleProcessor } from "./styles/processor_setup.js";
import { graphStyleRoots } from "./styles/root_graph.js";

/** Consumer modules loaded in one React-safe esbuild graph. */
export interface LoadedGraph {
  /** Fresh filesystem inventory; a bundle replay uses its already accepted config. */
  discovery?: EntryDiscovery;
  definitions: unknown[];
  documents?: readonly ResolvedDocument[];
  entrySources: readonly string[];
  sourceFiles: readonly string[];
  renderer: Renderer;
  renderWithComponents: ComponentGraphRenderer;
  /** Per-root generated CSS routes (renderer and entries only). */
  stylesheetRoutes: ReadonlyMap<string, string>;
  /** Non-HTML outputs: CSS and copied stylesheet/document resource bytes. */
  styleOutputs: ReadonlyMap<string, GeneratedFile>;
  /** Authored CSS-pass inputs and assets actually delivered by a root. */
  deliveredStyleSources: readonly string[];
  /** Globbed plugin dependencies monitored for new authored files. */
  postcssWatchDirectories?: ResolvedConfig["postcssWatchDirectories"];
}

/** Bundle and import all React-bearing consumer modules as one graph. */
export async function loadConsumerGraph(
  config: ResolvedConfig,
  evaluate = true,
  postcssLoader: PostcssConfigLoader = new FileSystemPostcssConfigLoader(),
): Promise<LoadedGraph> {
  return timeAsync(evaluate ? "graph.load" : "graph.inventory", () =>
    loadGraph(config, evaluate, postcssLoader),
  );
}

async function loadGraph(
  config: ResolvedConfig,
  evaluate: boolean,
  postcssLoader: PostcssConfigLoader,
): Promise<LoadedGraph> {
  const discovery = timeSync("graph.discover", () => discoverEntries(config));
  const entrySources = discovery.entryModules;
  config = { ...config, ...discovery };
  const documents = loadDocuments(config, discovery);
  timingCounts("graph", () => ({ entryModules: entrySources.length }));
  const outputPath = path.join(
    path.dirname(config.configPath),
    ".mokly-consumer.cjs",
  );
  const processor = await createStyleProcessor(config, postcssLoader);
  const styles = new GraphStyles(config, processor.preprocessor);
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
    const mapper = createMetafilePathMapper(path.dirname(config.configPath));
    const roots = graphStyleRoots(config, built.metafile, entrySources, mapper);
    const graphFiles = graphSourceFiles(
      built.metafile,
      path.dirname(config.configPath),
      config.repoRoot,
      config.mockupsDir,
      mapper,
    );
    const documentSources = normalizeSourceFiles(
      documents.sources,
      config.repoRoot,
      config.mockupsDir,
    );
    const graphInputs = new Set(
      [...graphFiles, ...documentSources].map((file) =>
        path.resolve(config.repoRoot, file),
      ),
    );
    const bundled = roots.some((root) => root.styles.length)
      ? await bundleStyles(
          config,
          roots,
          graphInputs,
          styles.preprocessor,
          styles.classMaps,
        )
      : {
          outputs: new Map<string, GeneratedFile>(),
          routes: new Map<string, string>(),
          sourceFiles: new Set<string>(),
        };
    const dependencies = collectPostcssDependencies(
      config,
      styles.preprocessor.reports,
      graphInputs,
    );
    const sourceFiles = normalizeSourceFiles(
      [
        ...graphFiles,
        ...documentSources,
        ...bundled.sourceFiles,
        ...styles.preprocessor.sourceFiles,
        ...dependencies.sourceFiles,
        ...(config.configSourceFiles ?? [config.configPath]),
        ...(config.protectedFiles ?? config.resolvedFiles ?? entrySources),
        ...(config.folderRecords ?? []).map((folder) => folder.sourcePath),
        ...(config.renderer ? [config.renderer] : []),
      ],
      config.repoRoot,
      config.mockupsDir,
    );
    const deliveredStyleSources = normalizeSourceFiles(
      [...bundled.sourceFiles],
      config.repoRoot,
      config.mockupsDir,
    );
    if (!evaluate)
      return {
        definitions: [],
        discovery,
        entrySources,
        sourceFiles,
        stylesheetRoutes: bundled.routes,
        styleOutputs: new Map([...bundled.outputs, ...documents.outputs]),
        documents: documents.entries,
        deliveredStyleSources,
        postcssWatchDirectories: dependencies.watchDirectories,
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
      documents: documents.entries,
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
    const graph: LoadedGraph = {
      definitions: imported.definitions,
      discovery,
      entrySources,
      sourceFiles,
      stylesheetRoutes: bundled.routes,
      styleOutputs: new Map([...bundled.outputs, ...documents.outputs]),
      documents: documents.entries,
      deliveredStyleSources,
      postcssWatchDirectories: dependencies.watchDirectories,
      renderer: imported.renderer as Renderer,
      renderWithComponents: imported.renderWithComponents,
    };
    rememberBundle(graph, bundle);
    return graph;
  } catch (error) {
    if (styles.failure) throw styles.failure;
    if (error instanceof MoklyError) throw error;
    if (isMoklyError(error))
      throw new MoklyError(error.code, error.detail, { cause: error });
    throw new MoklyError(
      "build-invalid",
      `could not bundle consumer modules: ${errorMessage(error)}`,
      {
        cause: error,
      },
    );
  } finally {
    await processor.close();
  }
}
