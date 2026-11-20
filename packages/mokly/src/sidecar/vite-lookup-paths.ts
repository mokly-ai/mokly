import { realpathSync } from "node:fs";
import path from "node:path";

import { importerDirectory } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
import { inside } from "./path-scope.js";
import { bareSpecifier, packageName } from "./specifier.js";
import { viteFile } from "./vite-urls.js";

/** One order serves Vite resolution and the config's synchronous Node imports. */
export function viteLookupImporters(
  paths: ModulePaths,
  directory: string,
  source: string,
  importer?: string,
): string[] {
  const file = viteFile(importer ?? "") ?? path.join(directory, "package.json");
  if (!bareSpecifier(source) || source.includes("\0")) return [file];
  const selected = importerDirectory(paths, source, path.dirname(file));
  const candidates = [file, path.join(selected, path.basename(file))];
  for (const root of paths.dependencyRoots) {
    const pkg = path.join(root, packageName(source));
    paths.lookupDirectories.add(root);
    paths.lookupDirectories.add(pkg);
    paths.lookupFiles.add(path.join(pkg, "package.json"));
    candidates.push(path.join(pkg, "package.json"));
  }
  return [...new Set(candidates)];
}

export function viteSourceResolution(
  paths: ModulePaths,
  file: string,
): boolean {
  return inside(paths.sourceRoot, realpathSync(file));
}

export function viteMissingImport(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(String(error.code))
  );
}
