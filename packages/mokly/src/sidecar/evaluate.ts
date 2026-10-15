import path from "node:path";

import type * as React from "react";

import { reviewMaterialKey } from "../authoring/data.js";
import { createAuthoring } from "../authoring/definitions.js";
import { AuthoringRuntime } from "../authoring/runtime.js";

import type { BundleExports, Generation } from "./bundle.js";
import { SidecarError, detail } from "./errors.js";

/** Evaluate only after the generation's complete class-map table is installed. */
export function evaluate(generation: Generation): BundleExports {
  if (generation.exports) return generation.exports;
  if (!generation.maps)
    throw new SidecarError(
      "bundle-failed",
      "cssModules must supply the generation's map table before evaluation",
    );
  for (const file of generation.cssModules)
    if (!Object.hasOwn(generation.maps, file))
      throw new SidecarError(
        "bundle-failed",
        `missing CSS Modules map: ${file}`,
      );
  try {
    let react: typeof React | undefined;
    try {
      react = generation.require("react");
    } catch {
      /* Page-only consumers need no React. */
    }
    generation.runtime = new AuthoringRuntime(react);
    const module = { exports: {} };
    const require = (name: string) =>
      name === generation.runtimeKey
        ? {
            authoring: (source?: string) => ({
              ...createAuthoring(generation.runtime, source),
              reviewMaterialKey,
            }),
            css: (file: string) => generation.maps![file],
          }
        : generation.require(name);
    const execute = new Function(
      "module",
      "exports",
      "require",
      "__dirname",
      "__filename",
      generation.code,
    );
    execute(
      module,
      module.exports,
      require,
      generation.params.sourceRoot,
      path.join(generation.params.sourceRoot, "package.json"),
    );
    return (generation.exports = module.exports as BundleExports);
  } catch (error) {
    throw new SidecarError(
      "bundle-failed",
      `${[...generation.params.entryFiles, ...generation.params.storiesFiles, ...(generation.params.renderer ? [generation.params.renderer] : [])].join(", ")}: ${detail(error)}`,
    );
  }
}
