import { loadConsumerGraph } from "../build/load_graph.js";
import type { ResolvedConfig } from "../config/types.js";

/** Refresh exact watch inputs from one inventory-only graph load. */
export async function hydrateWatchInventory(
  config: ResolvedConfig,
  signal?: AbortSignal,
): Promise<void> {
  const inventory = await loadConsumerGraph(config, false, undefined, signal);
  Object.assign(config, inventory.discovery);
  config.entryModules = inventory.entrySources;
  config.sourceFiles = inventory.sourceFiles;
  config.postcssWatchDirectories = inventory.postcssWatchDirectories ?? [];
}
