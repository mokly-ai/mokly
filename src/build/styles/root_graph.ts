import path from "node:path";

import type { Metafile } from "esbuild";

import type { ResolvedConfig } from "../../config/types.js";
import {
  createMetafilePathMapper,
  type MetafilePathMapper,
} from "../metafile_paths.js";

import { orderedStyles } from "./order.js";
import { validateRootStyleImports } from "./root_validation.js";

/** Resolve graph delivery roots and validate their direct CSS imports. */
export function graphStyleRoots(
  config: ResolvedConfig,
  metafile: Metafile,
  entries: readonly string[],
  mapper: MetafilePathMapper = createMetafilePathMapper(
    path.dirname(config.configPath),
  ),
): readonly {
  readonly path: string;
  readonly styles: readonly string[];
}[] {
  const workingDir = path.dirname(config.configPath);
  const roots = [
    ...(config.renderer ? [{ path: config.renderer }] : []),
    ...entries.map((entry) => ({ path: entry })),
  ].map((root) => ({
    ...root,
    styles: orderedStyles(
      metafile,
      root.path,
      workingDir,
      new Set(),
      mapper,
    ).filter(
      (file) =>
        config.moduleResolution.loaders[".css"] !== "empty" &&
        (!file.endsWith(".module.css") ||
          config.moduleResolution.loaders[".module.css"] !== "empty"),
    ),
  }));
  validateRootStyleImports(config, metafile, roots, mapper);
  return roots;
}
