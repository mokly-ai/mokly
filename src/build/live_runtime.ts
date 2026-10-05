/** Prepare a last-good routing generation without invoking a consumer renderer. */
import { randomBytes } from "node:crypto";

import { entryRoute, documentRoute, generatedViews } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { createCatalogueIndex } from "../registry/catalogue_index.js";
import { MANIFEST_NAME } from "../registry/manifest.js";
import { prepareRegistry } from "../registry/prepare.js";
import type { PreparedRegistry } from "../registry/prepared_types.js";

import type { ComponentRuntime } from "./component_runtime.js";
import { consumerBundle } from "./consumer_bundle.js";
import { loadConsumerGraph, type LoadedGraph } from "./load_graph.js";
import { captureOutputSnapshot } from "./output_snapshot.js";
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
      ...graph.discovery,
      entryModules: graph.entrySources,
      sourceFiles: graph.sourceFiles,
      postcssWatchDirectories: graph.postcssWatchDirectories ?? [],
    };
    const registry =
      prepared ??
      prepareRegistry(graph.definitions, config, graph.documents, onWarning);
    if (prepared) registry.warnings.forEach(onWarning ?? (() => undefined));
    const manifest = createCatalogueIndex(
      registry.entries,
      graph.sourceFiles,
      config.colorSchemes,
      registry.folders,
    );
    const outputSnapshot = await captureOutputSnapshot(
      [
        MANIFEST_NAME,
        ...manifest.entries.flatMap((entry) =>
          entry.kind === "document"
            ? entry.colorSchemes.map((scheme) =>
                documentRoute(entry.path, scheme),
              )
            : entry.kind === "page"
              ? [entryRoute(entry.path)]
              : generatedViews(entry).map((view) => view.path),
        ),
        ...graph.styleOutputs.keys(),
      ],
      config,
    );
    return {
      ...([...(config.warnings ?? []), ...registry.warnings].length
        ? { warnings: [...(config.warnings ?? []), ...registry.warnings] }
        : {}),
      outputSnapshot,
      bundle: consumerBundle(graph),
      config,
      generation: randomBytes(16).toString("hex"),
      manifest,
      outputs: [],
      stylesheetRoutes: [...graph.stylesheetRoutes],
      styleOutputs: [...graph.styleOutputs],
      deliveredStyleSources: graph.deliveredStyleSources,
    };
  });
}
