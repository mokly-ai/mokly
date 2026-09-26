/** Prepare a last-good routing generation without invoking a consumer renderer. */
import { randomBytes } from "node:crypto";

import { generatedViews } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { createCatalogueIndex } from "../registry/catalogue_index.js";
import { prepareRegistry } from "../registry/prepare.js";
import type { PreparedRegistry } from "../registry/prepared_types.js";

import type { ComponentRuntime } from "./component_runtime.js";
import { consumerBundle } from "./consumer_bundle.js";
import { loadConsumerGraph, type LoadedGraph } from "./load_graph.js";
import { validateGeneratedOutputPaths } from "./output_paths.js";
import type { BuildWarning } from "./warnings.js";

export async function prepareLiveRuntime(
  config: ResolvedConfig,
  preloaded?: LoadedGraph,
  prepared?: PreparedRegistry,
  onWarning?: (warning: BuildWarning) => void,
): Promise<ComponentRuntime> {
  return timeAsync("catalogue.prepare-index", async () => {
    config.warnings?.forEach(onWarning ?? (() => undefined));
    const graph = preloaded ?? (await loadConsumerGraph(config));
    config = {
      ...config,
      entryModules: graph.entrySources,
      sourceFiles: graph.sourceFiles,
    };
    const registry =
      prepared ?? prepareRegistry(graph.definitions, config, onWarning);
    if (prepared) registry.warnings.forEach(onWarning ?? (() => undefined));
    const manifest = createCatalogueIndex(
      registry.entries,
      graph.sourceFiles,
      config.colorSchemes,
    );
    validateGeneratedOutputPaths(
      manifest.entries.flatMap((entry) =>
        entry.kind === "page"
          ? [entry.route]
          : generatedViews(entry).map((view) => view.path),
      ),
      config,
    );
    return {
      ...([...(config.warnings ?? []), ...registry.warnings].length
        ? { warnings: [...(config.warnings ?? []), ...registry.warnings] }
        : {}),
      bundle: consumerBundle(graph),
      config,
      generation: randomBytes(16).toString("hex"),
      manifest,
      outputs: [],
    };
  });
}
