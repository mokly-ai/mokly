import { isDeepStrictEqual } from "node:util";

import { loadConfig } from "../config/load.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import type { ComponentRuntime } from "./component_runtime.js";
import { loadConsumerGraph } from "./load_graph.js";
import { validateGeneratedOutputPaths } from "./output_paths.js";
import { normalizeSourceFiles } from "./source_inventory.js";

/** Re-resolve both graphs without rendering or writing consumer output. */
export async function assertFreshSourceInventory(
  config: ResolvedConfig,
  manifest: ComponentRuntime["manifest"],
): Promise<void> {
  const current = await loadConfig(config.repoRoot, config.configPath);
  const graph = await loadConsumerGraph(current, false);
  if (
    !isDeepStrictEqual(graph.sourceFiles, manifest.sourceFiles) ||
    !isDeepStrictEqual(
      normalizeSourceFiles(manifest.sourceFiles, config.repoRoot),
      manifest.sourceFiles,
    )
  )
    throw new MoklyError(
      "manifest-invalid",
      "source inventory is stale; run mokly build before serving or publishing",
    );
  config.sourceFiles = graph.sourceFiles;
  config.configSourceFiles = current.configSourceFiles ?? [];
  validateGeneratedOutputPaths(
    manifest.entries.flatMap((entry) =>
      entry.kind === "screen"
        ? [
            ...Object.values(entry.fragments),
            ...Object.values(entry.darkFragments ?? {}),
          ]
        : [entry.route],
    ),
    config,
  );
}
