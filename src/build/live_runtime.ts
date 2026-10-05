/** Prepare a last-good routing generation without invoking a consumer renderer. */
import { randomBytes } from "node:crypto";

import { entryRoute, documentRoute, generatedViews } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import { createCatalogueIndex } from "../registry/catalogue_index.js";
import { MANIFEST_NAME } from "../registry/manifest.js";
import { prepareRegistry } from "../registry/prepare.js";

import type { ComponentRuntime } from "./component_runtime.js";
import { consumerBundle } from "./consumer_bundle.js";
import { loadConsumerGraph } from "./load_graph.js";
import { captureOutputSnapshot } from "./output_snapshot.js";

export async function prepareLiveRuntime(
  config: ResolvedConfig,
): Promise<ComponentRuntime> {
  return timeAsync("catalogue.prepare-index", async () => {
    const graph = await loadConsumerGraph(config, {
      captureInteractiveSources: config.interactive === "serve",
    });
    config = {
      ...config,
      ...graph.discovery,
      entryModules: graph.entrySources,
      sourceFiles: graph.sourceFiles,
      postcssWatchDirectories: graph.postcssWatchDirectories ?? [],
    };
    const registry = prepareRegistry(
      graph.definitions,
      config,
      graph.documents,
    );
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
    const interactiveSources =
      config.interactive === "serve"
        ? graph.interactiveSourceCapture?.seal()
        : undefined;
    if (config.interactive === "serve" && !interactiveSources)
      throw new MoklyError(
        "build-invalid",
        "Live runtime is missing its accepted source capture",
      );
    return {
      outputSnapshot,
      bundle: consumerBundle(graph),
      config,
      generation: randomBytes(16).toString("hex"),
      interactiveEntries: Object.fromEntries(
        manifest.entries.flatMap((entry) =>
          entry.kind === "screen" || entry.kind === "component"
            ? [[entry.path, entry.interactive] as const]
            : [],
        ),
      ),
      ...(interactiveSources ? { interactiveSources } : {}),
      manifest,
      outputs: [],
      stylesheetRoutes: [...graph.stylesheetRoutes],
      styleOutputs: [...graph.styleOutputs],
      deliveredStyleSources: graph.deliveredStyleSources,
    };
  });
}
