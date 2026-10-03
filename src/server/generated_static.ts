import fs from "node:fs";
import path from "node:path";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { GeneratedFile } from "../build/generated_file.js";
import { loadConsumerGraph } from "../build/load_graph.js";
import { GENERATED_DIRECTORY } from "../build/styles/routes.js";
import type { ResolvedConfig } from "../config/types.js";

/** Resolve the accepted reserved routes before binding a committed server. */
export async function expectedGeneratedRoutes(
  config: ResolvedConfig,
  runtime?: ComponentRuntime,
): Promise<ReadonlySet<string>> {
  return !runtime &&
    config.generatedOutput === "committed" &&
    fs.existsSync(path.join(config.mockupsDir, GENERATED_DIRECTORY))
    ? new Set((await loadConsumerGraph(config, false)).styleOutputs.keys())
    : new Set<string>();
}

/** Snapshot accepted reserved files once, never resolving a request through disk. */
export function acceptedGeneratedStatic(
  config: ResolvedConfig,
  runtime?: ComponentRuntime,
  routes: ReadonlySet<string> = new Set(),
): ReadonlyMap<string, GeneratedFile> {
  if (runtime) return new Map(runtime.styleOutputs);
  const files = new Map<string, GeneratedFile>();
  if (config.generatedOutput === "derived") return files;
  const root = path.join(config.mockupsDir, GENERATED_DIRECTORY);
  if (!fs.existsSync(root)) return files;
  for (const route of routes) {
    const file = path.join(config.mockupsDir, route);
    try {
      if (fs.statSync(file).isFile()) files.set(route, fs.readFileSync(file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return files;
}
