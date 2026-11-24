import path from "node:path";

import type { ModulePaths } from "./module-paths.js";
import { importerDirectory } from "./package-directory.js";
import type { PackageJson } from "./package-json.js";
import type { PhysicalInputs } from "./physical-inputs.js";
import { resolutionOptions } from "./resolution.js";
import { packageName } from "./specifier.js";

export interface PackageLocation {
  directory: string;
  manifest: PackageJson;
}

export function nearestPackage(
  inputs: PhysicalInputs,
  directory: string,
  observe = true,
  current = false,
  allowNonObject = false,
): PackageLocation | undefined {
  for (;;) {
    const manifest = inputs.packageJson(
      path.join(directory, "package.json"),
      observe,
      current,
      allowNonObject,
    );
    if (manifest) return { directory, manifest };
    const parent = path.dirname(directory);
    if (parent === directory || !inputs.complete) return undefined;
    directory = parent;
  }
}

/** Shared installed, linked, and configured lookup roots after Mokly's importer mapping. */
export function* packageDirectories(
  paths: ModulePaths,
  name: string,
  directory: string,
): Generator<string> {
  const identifier = packageName(name);
  const roots = new Set([
    ...ancestorNodeModules(directory),
    ...ancestorNodeModules(importerDirectory(paths, name, directory)),
    ...resolutionOptions(paths.sourceRoot, paths.settings).nodePaths,
  ]);
  for (const root of roots) yield path.join(root, identifier);
}

export function* ancestorNodeModules(directory: string): Generator<string> {
  for (;;) {
    if (path.basename(directory) !== "node_modules")
      yield path.join(directory, "node_modules");
    const parent = path.dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}
