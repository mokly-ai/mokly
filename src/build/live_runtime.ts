/** Prepare a last-good routing generation without invoking a consumer renderer. */
import { randomBytes } from "node:crypto";

import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { createCatalogueIndex } from "../registry/catalogue_index.js";
import { generatedDocumentRoutes } from "../registry/generated_documents.js";
import { MANIFEST_NAME } from "../registry/manifest.js";
import { prepareRegistry } from "../registry/prepare.js";
import type { PreparedRegistry } from "../registry/prepared_types.js";

import type { BuildDiagnostic } from "./build_warnings.js";
import type { ComponentRuntime } from "./component_runtime.js";
import { consumerBundle } from "./consumer_bundle.js";
import { loadConsumerGraph, type LoadedGraph } from "./load_graph.js";
import { captureOutputSnapshot } from "./output_snapshot.js";

export async function prepareLiveRuntime(
  config: ResolvedConfig,
  preloaded?: LoadedGraph,
  prepared?: PreparedRegistry,
  onWarning?: (warning: BuildDiagnostic) => void,
  generation = randomBytes(16).toString("hex"),
): Promise<ComponentRuntime> {
  return timeAsync("catalogue.prepare-index", async () => {
    config.diagnostics?.forEach(onWarning ?? (() => undefined));
    const graph = preloaded ?? (await loadConsumerGraph(config));
    config = {
      ...config,
      ...graph.discovery,
      entryModules: graph.entrySources,
      sourceFiles: graph.sourceFiles,
      postcssWatchDirectories: graph.postcssWatchDirectories ?? [],
    };
    const registry =
      prepared ??
      prepareRegistry(graph.definitions, config, graph.documents, onWarning);
    if (prepared) registry.diagnostics.forEach(onWarning ?? (() => undefined));
    const manifest = createCatalogueIndex(
      registry.entries,
      graph.sourceFiles,
      config.colorSchemes,
      registry.folders,
    );
    const outputSnapshot = await captureOutputSnapshot(
      [
        MANIFEST_NAME,
        ...generatedDocumentRoutes(manifest.entries),
        ...graph.styleOutputs.keys(),
      ],
      config,
    );
    return {
      outputSnapshot,
      bundle: consumerBundle(graph),
      config,
      generation,
      warningGeneration: generation,
      manifest,
      outputs: [],
      stylesheetRoutes: [...graph.stylesheetRoutes],
      styleOutputs: [...graph.styleOutputs],
      deliveredStyleSources: graph.deliveredStyleSources,
    };
  });
}
