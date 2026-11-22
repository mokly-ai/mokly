import fs from "node:fs";
import path from "node:path";

import { cooperativeYield } from "./cooperative-yield.js";
import { SidecarError } from "./errors.js";
import { metadataDigest } from "./file-digests.js";
import type { ModulePaths } from "./module-paths.js";
import { inside } from "./path-scope.js";
import { FRAME_LIMIT } from "./transport.js";

/** Capture non-directory membership without retaining source contents. */
export async function directoryFiles(
  directory: string,
  limit = FRAME_LIMIT / 2,
): Promise<string[]> {
  const pause = cooperativeYield();
  if (pause) await pause;
  try {
    const names: string[] = [];
    let bytes = 2;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const pause = cooperativeYield();
      if (pause) await pause;
      if (entry.isDirectory()) continue;
      bytes += Buffer.byteLength(JSON.stringify(entry.name)) + 1;
      if (bytes > limit)
        throw new SidecarError(
          "bundle-failed",
          `Compiled bundle data needs more than ${FRAME_LIMIT} bytes. The sidecar limit is ${FRAME_LIMIT} bytes. Reduce the bundle and retry.`,
        );
      names.push(entry.name);
    }
    return names.sort();
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
  for (const directory of paths.lookupDirectories) {
    directories.add(await paths.metadata(directory));
    const pause = cooperativeYield();
    if (pause) await pause;
  }
  for (const file of consumed) {
    let directory = path.dirname(file);
    directories.add(directory);
    const root = inside(paths.sourceRoot, file)
      ? paths.sourceRoot
      : paths.dependencyDirectory(file)!;
    while (inside(root, directory)) {
      ancestors.add(directory);
      if (directory === root) break;
      directory = path.dirname(directory);
    }
    const pause = cooperativeYield();
    if (pause) await pause;
  }
  for (const lookup of [...paths.lookupFiles].sort()) {
    const file = await paths.metadata(lookup);
    metadataInputs[paths.metadataName(file)] = inputs[file] =
      await metadataDigest(file, inputs);
  }
  for (const directory of [...ancestors].sort()) {
    for (const name of ["package.json", "tsconfig.json"]) {
      const file = path.join(directory, name);
      metadataInputs[paths.metadataName(file)] = inputs[file] =
        await metadataDigest(file, inputs);
    }
  }
  const inputDirectories = new Map<string, string[]>();
  const metadataDirectories = new Map<string, string[]>();
  let remaining = FRAME_LIMIT / 2;
  for (const directory of [...directories].sort()) {
    const names = await directoryFiles(directory, remaining);
    remaining -= Buffer.byteLength(JSON.stringify(names));
    inputDirectories.set(directory, names);
    metadataDirectories.set(paths.metadataName(directory), names);
  }
  return {
    inputDirectories: Object.fromEntries(inputDirectories),
    metadataDirectories: Object.fromEntries(metadataDirectories),
  };
}
