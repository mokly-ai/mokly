import { loadConsumerGraph } from "../build/load_graph.js";
import type { ResolvedConfig } from "../config/types.js";

/** Refresh exact watch inputs from one inventory-only graph load. */
export async function hydrateWatchInventory(
  config: ResolvedConfig,
): Promise<void> {
  const inventory = await loadConsumerGraph(config, false);
  config.entryModules = inventory.entrySources;
  config.sourceFiles = inventory.sourceFiles;
  config.postcssWatchDirectories = inventory.postcssWatchDirectories ?? [];
}
