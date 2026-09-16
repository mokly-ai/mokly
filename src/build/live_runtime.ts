/** Prepare a last-good routing generation without invoking a consumer renderer. */
import { randomBytes } from "node:crypto";

import { generatedViews } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { createCatalogueIndex } from "../registry/catalogue_index.js";
import { prepareRegistry } from "../registry/prepare.js";

import type { ComponentRuntime } from "./component_runtime.js";
import { consumerBundle } from "./consumer_bundle.js";
import { loadConsumerGraph } from "./load_graph.js";
import { validateGeneratedOutputPaths } from "./output_paths.js";

export async function prepareLiveRuntime(
  config: ResolvedConfig,
): Promise<ComponentRuntime> {
  return timeAsync("catalogue.prepare-index", async () => {
    const graph = await loadConsumerGraph(config);
    config = { ...config, sourceFiles: graph.sourceFiles };
    const registry = prepareRegistry(graph.definitions, config);
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
      bundle: consumerBundle(graph),
      config,
      generation: randomBytes(16).toString("hex"),
      manifest,
      outputs: [],
    };
  });
}
