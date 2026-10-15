import fs from "node:fs/promises";
import path from "node:path";

import type { ModuleResolution } from "../generated/sidecar/ModuleResolution.js";

import { inside } from "./paths.js";

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

/** A linked repository package must use the requested side's own sources. */
export async function sideModule(
  file: string,
  sourceRoot: string,
  repositories: string[],
): Promise<string> {
  if (!path.isAbsolute(file)) return file;
  const real = await fs.realpath(file);
  if (real.split(path.sep).includes("node_modules") || inside(sourceRoot, real))
    return real;
  for (const repository of repositories) {
    const root = await fs.realpath(repository);
    if (!inside(root, real)) continue;
    const mapped = path.resolve(sourceRoot, path.relative(root, real));
    try {
      const target = await fs.realpath(mapped);
      if (!inside(sourceRoot, target) || !(await fs.stat(target)).isFile())
        throw new Error("invalid mapped file");
      return target;
    } catch (error) {
      throw new Error(`module ${real} has no source in this side: ${mapped}`, {
        cause: error,
      });
    }
  }
  return real;
}
