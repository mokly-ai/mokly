import { isDeepStrictEqual } from "node:util";

import { entryRoute, generatedViews } from "@mokly/viewer/data";

import { loadConfig } from "../config/load.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import type { ComponentRuntime } from "./component_runtime.js";
import { loadConsumerGraph, type LoadedGraph } from "./load_graph.js";
import { validateGeneratedOutputPaths } from "./output_paths.js";
import { normalizeSourceFiles } from "./source_inventory.js";

/** Re-resolve both graphs without rendering or writing consumer output. */
export async function assertFreshSourceInventory(
  config: ResolvedConfig,
  manifest: ComponentRuntime["manifest"],
): Promise<LoadedGraph> {
  const current = await loadConfig(config.repoRoot, config.configPath);
  const graph = await loadConsumerGraph(current, { evaluate: false });
  if (
    !isDeepStrictEqual(graph.sourceFiles, manifest.sourceFiles) ||
    !isDeepStrictEqual(
      normalizeSourceFiles(
        manifest.sourceFiles,
        config.repoRoot,
        config.mockupsDir,
      ),
      manifest.sourceFiles,
    )
  )
    throw new MoklyError(
      "manifest-invalid",
      "source inventory is stale; run mokly build before serving or publishing",
    );
  config.sourceFiles = graph.sourceFiles;
  config.postcssWatchDirectories = graph.postcssWatchDirectories ?? [];
  config.configSourceFiles = current.configSourceFiles ?? [];
  validateGeneratedOutputPaths(
    manifest.entries.flatMap((entry) => {
      if (entry.kind === "page") return [entryRoute("page", entry.id)];
      return generatedViews(entry).map((view) => view.path);
    }),
    config,
  );
  return graph;
}
