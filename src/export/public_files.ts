import fs from "node:fs";
import path from "node:path";

import { generatedBytes, type GeneratedFile } from "../build/generated_file.js";
import {
  GENERATED_DIRECTORY,
  isGeneratedRoute,
  isPublicGeneratedRoute,
} from "../build/styles/routes.js";
import { toPosixPath } from "../config/paths.js";
import { isPublicStaticFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";

import { exportError } from "./error.js";
import { generatedParentDirectories } from "./generated_inventory.js";
import { exportResourcePolicy } from "./resource_policy.js";

/** Capture exact generated output and ordinary public bytes without broad directory grants. */
export async function capturePublicFiles(
  config: ResolvedConfig,
  generated?: ReadonlyMap<string, GeneratedFile>,
): Promise<ReadonlyMap<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const accepted = new Set(generated?.keys());
  const parents = generatedParentDirectories(accepted);
  const isPublic = exportResourcePolicy(config);
  const isGeneratedPublic = exportResourcePolicy(config, true, accepted);
  const visit = async (
    directory: string,
    generatedOnly = false,
  ): Promise<void> => {
    const entries = await fs.promises
      .readdir(directory, { withFileTypes: true })
      .catch((error: NodeJS.ErrnoException) => {
        if (
          generated &&
          directory === config.mockupsDir &&
          error.code === "ENOENT"
        )
          return [];
        throw error;
      });
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      const name = toPosixPath(path.relative(config.mockupsDir, candidate));
      if (generated && name === GENERATED_DIRECTORY) continue;
      if (!generated && entry.isDirectory() && isGeneratedRoute(name)) {
        await visit(candidate);
        continue;
      }
      const publicName = !generatedOnly && isPublic(name);
      const generatedPath = accepted.has(name) || parents.has(name);
      if (!publicName && !generatedPath) continue;
      if (entry.isSymbolicLink())
        throw exportError(`Public export resource is a symlink: ${name}`);
      if (accepted.has(name)) continue;
      if (entry.isDirectory()) await visit(candidate, !publicName);
      else if (entry.isFile() && isPublicStaticFile(candidate, config))
        files.set(name, await fs.promises.readFile(candidate));
      else
        throw exportError(
          `Public export resource is not a regular file: ${name}`,
        );
    }
  };
  await visit(config.mockupsDir);
  for (const [name, bytes] of generated ?? []) {
    if (
      (isGeneratedRoute(name) && !isPublicGeneratedRoute(name, accepted)) ||
      !isGeneratedPublic(name)
    )
      continue;
    if (config.generatedOutput === "derived")
      files.set(name, generatedBytes(bytes));
    else {
      const target = path.join(config.mockupsDir, name);
      if (!(await fs.promises.lstat(target)).isFile())
        throw exportError(
          `Public export resource is not a regular file: ${name}`,
        );
      files.set(name, await fs.promises.readFile(target));
    }
  }
  return new Map(
    [...files].sort(([left], [right]) => left.localeCompare(right)),
  );
}
