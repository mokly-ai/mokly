import path from "node:path";

import type { Loader } from "esbuild";

import type { ResolvedConfig } from "../config/types.js";

const DEFAULT_LOADERS: Readonly<Record<string, Loader>> = {
  ".cjs": "js",
  ".css": "css",
  ".cts": "ts",
  ".js": "js",
  ".json": "json",
  ".jsx": "jsx",
  ".mjs": "js",
  ".mts": "ts",
  ".ts": "ts",
  ".tsx": "tsx",
  ".txt": "text",
};

/** Select the configured or standard esbuild loader for one source path. */
export function interactiveSourceLoader(
  candidate: string,
  config: ResolvedConfig,
): Loader | undefined {
  if (candidate.endsWith(".css")) return "js";
  const extension = path.extname(candidate).toLowerCase();
  return (
    config.moduleResolution.loaders[extension] ?? DEFAULT_LOADERS[extension]
  );
}
