import path from "node:path";

import type { ModuleResolution } from "../generated/sidecar/ModuleResolution.js";

export function resolutionOptions(root: string, settings: ModuleResolution) {
  return {
    alias: settings.aliases,
    conditions: settings.conditions,
    nodePaths: settings.packageRoots.map((directory) => {
      const absolute = path.resolve(root, directory);
      return path.basename(absolute) === "node_modules"
        ? absolute
        : path.join(absolute, "node_modules");
    }),
    ...(settings.mainFields.length ? { mainFields: settings.mainFields } : {}),
    ...(settings.resolveExtensions.length
      ? { resolveExtensions: settings.resolveExtensions }
      : {}),
  };
}
