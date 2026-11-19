import path from "node:path";

import { importerDirectory } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
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
  const roots = new Set<string>();
  for (let start of new Set([
    directory,
    importerDirectory(paths, name, directory),
  ])) {
    for (;;) {
      if (path.basename(start) !== "node_modules")
        roots.add(path.join(start, "node_modules"));
      const parent = path.dirname(start);
      if (parent === start) break;
      start = parent;
    }
  }
  for (const root of resolutionOptions(paths.sourceRoot, paths.settings)
    .nodePaths)
    roots.add(root);
  for (const root of roots) yield path.join(root, packageName(name));
}
