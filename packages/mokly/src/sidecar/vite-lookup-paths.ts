import fs from "node:fs/promises";
import path from "node:path";

import { missingFile } from "./file-digests.js";
import type { ModulePaths } from "./module-paths.js";
import { importerDirectory } from "./package-directory.js";
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
  const file = viteLookupImporter(directory, importer);
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

export function viteLookupImporter(
  directory: string,
  importer?: string,
): string {
  return viteFile(importer ?? "") ?? path.join(directory, "package.json");
}

export function viteSourceResolution(
  paths: ModulePaths,
  file: string,
): boolean {
  return inside(paths.sourceRoot, file);
}

export function viteMissingImport(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(String(error.code))
  );
}

export async function viteExistingImporter(
  file: string,
): Promise<string | undefined> {
  try {
    if ((await fs.stat(file)).isFile()) return file;
  } catch (error) {
    if (!missingFile(error)) throw error;
  }
  let directory = path.dirname(file);
  for (;;) {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const selected = entries
        .filter((entry) => entry.isFile())
        .sort((a, b) => a.name.localeCompare(b.name));
      const anchor =
        selected.find((entry) => entry.name === "package.json") ?? selected[0];
      if (anchor) return path.join(directory, anchor.name);
    } catch (error) {
      if (!missingFile(error)) throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}
