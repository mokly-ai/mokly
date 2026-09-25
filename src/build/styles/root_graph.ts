import path from "node:path";

import type { Metafile } from "esbuild";

import type { ResolvedConfig } from "../../config/types.js";

import { orderedStyles } from "./order.js";
import { validateRootStyleImports } from "./root_validation.js";

/** Resolve graph delivery roots and validate their direct CSS imports. */
export function graphStyleRoots(
  config: ResolvedConfig,
  metafile: Metafile,
  entries: readonly string[],
): readonly {
  readonly path: string;
  readonly emit: boolean;
  readonly styles: readonly string[];
}[] {
  const workingDir = path.dirname(config.configPath);
  const roots = [
    ...(config.renderer ? [{ path: config.renderer, emit: true }] : []),
    ...entries.map((entry) => ({ path: entry, emit: true })),
    ...(config.compatibility.transformer
      ? [{ path: config.compatibility.transformer, emit: false }]
      : []),
  ].map((root) => ({
    ...root,
    styles: orderedStyles(metafile, root.path, workingDir).filter(
      (file) =>
        config.moduleResolution.loaders[".css"] !== "empty" &&
        (!file.endsWith(".module.css") ||
          config.moduleResolution.loaders[".module.css"] !== "empty"),
    ),
  }));
  validateRootStyleImports(config, metafile, roots, workingDir);
  return roots;
}
