import fs from "node:fs";
import path from "node:path";

import { generatedBytes, type GeneratedFile } from "../build/generated_file.js";
import { toPosixPath } from "../config/paths.js";
import { isPublicStaticFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";

import { exportError } from "./error.js";
import { exportResourcePolicy } from "./resource_policy.js";

/** Capture ordinary public bytes once, rejecting selected symlinks explicitly. */
export async function capturePublicFiles(
  config: ResolvedConfig,
  generated?: ReadonlyMap<string, GeneratedFile>,
): Promise<ReadonlyMap<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const isPublic = exportResourcePolicy(config);
  const visit = async (directory: string): Promise<void> => {
    const entries = await fs.promises
      .readdir(directory, {
        withFileTypes: true,
      })
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
      if (!isPublic(name)) continue;
      if (generated?.has(name)) continue;
      if (entry.isSymbolicLink())
        throw exportError(`Public export resource is a symlink: ${name}`);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile() && isPublicStaticFile(candidate, config))
        files.set(name, await fs.promises.readFile(candidate));
      else
        throw exportError(
          `Public export resource is not a regular file: ${name}`,
        );
    }
  };
  await visit(config.mockupsDir);
  for (const [name, bytes] of generated ?? [])
    if (isPublic(name)) files.set(name, generatedBytes(bytes));
  return new Map(
    [...files].sort(([left], [right]) => left.localeCompare(right)),
  );
}
