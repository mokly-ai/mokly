import fs from "node:fs/promises";
import path from "node:path";

import { fileDigest } from "./compiled.js";
import type { ModulePaths } from "./module-paths.js";
import { inside } from "./path-scope.js";

/** Capture file membership without retaining source contents. */
export async function directoryFiles(directory: string): Promise<string[]> {
  try {
    return (await fs.readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["ENOENT", "ENOTDIR"].includes(String(error.code))
    )
      return [];
    throw error;
  }
}

/** Resolution reads ancestor manifests and tsconfig files, including absent candidates. */
export async function resolutionInputs(
  paths: ModulePaths,
  consumed: Iterable<string>,
  inputs: Record<string, string | null>,
  metadataInputs: Record<string, string | null>,
) {
  const ancestors = new Set<string>();
  const directories = new Set<string>();
  for (const directory of paths.lookupDirectories)
    directories.add(await paths.metadata(directory));
  for (const file of consumed) {
    let directory = path.dirname(file);
    directories.add(directory);
    const root = inside(paths.sourceRoot, file)
      ? paths.sourceRoot
      : paths.dependencyDirectory(file);
    if (!root) throw new Error("consumed module is outside the selected roots");
    while (inside(root, directory)) {
      ancestors.add(directory);
      if (directory === root) break;
      directory = path.dirname(directory);
    }
  }
  for (const lookup of [...paths.lookupFiles].sort()) {
    const file = await paths.metadata(lookup);
    metadataInputs[paths.name(file)] = inputs[file] = await fileDigest(file);
  }
  for (const directory of [...ancestors].sort()) {
    for (const name of ["package.json", "tsconfig.json"]) {
      const file = path.join(directory, name);
      metadataInputs[paths.name(file)] = inputs[file] = await fileDigest(file);
    }
  }
  const inputDirectories = new Map<string, string[]>();
  const metadataDirectories = new Map<string, string[]>();
  for (const directory of [...directories].sort()) {
    const names = await directoryFiles(directory);
    inputDirectories.set(directory, names);
    metadataDirectories.set(paths.name(directory), names);
  }
  return {
    inputDirectories: Object.fromEntries(inputDirectories),
    metadataDirectories: Object.fromEntries(metadataDirectories),
  };
}
