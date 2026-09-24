import fs from "node:fs";
import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { GENERATED_DIRECTORY } from "../config/paths.js";
import { isPublicStaticFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

import { exportError } from "./error.js";
import { exportResourceDenial } from "./resource_policy.js";

/** Capture compiled documents and only their validated authored closure. */
export async function capturePublicFiles(
  config: ResolvedConfig,
  generated: ReadonlyMap<string, string>,
  closure: readonly string[],
): Promise<ReadonlyMap<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const denial = exportResourceDenial(config);
  for (const name of closure) {
    if (
      !isSafeRepositoryPath(name) ||
      name.startsWith(`${GENERATED_DIRECTORY}/`)
    )
      throw exportError(`Invalid referenced asset: ${name}`);
    const reason = denial(name);
    if (reason)
      throw exportError(`Private export resource: ${name} (${reason})`);
    const segments = name.split("/");
    let candidate = config.mockupsDir;
    for (const [index, segment] of segments.entries()) {
      candidate = path.join(candidate, segment);
      const stat = await fs.promises.lstat(candidate).catch(() => undefined);
      if (!stat || stat.isSymbolicLink())
        throw exportError(
          `Referenced export resource is missing or a symlink: ${name}`,
        );
      if (index < segments.length - 1 && !stat.isDirectory())
        throw exportError(
          `Referenced export resource is not a regular file: ${name}`,
        );
      if (index === segments.length - 1 && !stat.isFile())
        throw exportError(
          `Referenced export resource is not a regular file: ${name}`,
        );
    }
    if (!isPublicStaticFile(candidate, config))
      throw exportError(`Private export resource: ${name}`);
    files.set(name, await fs.promises.readFile(candidate));
  }
  for (const [name, content] of generated) {
    if (name === MANIFEST_NAME) continue;
    if (!isSafeRepositoryPath(name))
      throw exportError(`Invalid generated route: ${name}`);
    files.set(`${GENERATED_DIRECTORY}/${name}`, Buffer.from(content));
  }
  return new Map(
    [...files].sort(([left], [right]) => left.localeCompare(right)),
  );
}
