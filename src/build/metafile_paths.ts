/** Esbuild metafile keys use the real working directory, even for symlinked roots. */
import fs from "node:fs";
import path from "node:path";

import { logicalRepositoryPath } from "../config/file_locations.js";
import { toPosixPath } from "../config/paths.js";

/** Find the metafile key for an existing module or emitted output. */
export function metafileKey(workingDir: string, candidate: string): string {
  return createMetafilePathMapper(workingDir).key(candidate);
}

/** Project an esbuild key back under the configured logical working directory. */
export function metafilePath(workingDir: string, key: string): string {
  return createMetafilePathMapper(workingDir).path(key);
}

/** Map one esbuild metafile without resolving its working directory per edge. */
export interface MetafilePathMapper {
  /** Find a key for an authored root or emitted output. */
  key(candidate: string): string;
  /** Project a metafile key to the configured logical working directory. */
  path(key: string): string;
}

/** Resolve the physical working directory once for a whole metafile. */
export function createMetafilePathMapper(
  workingDir: string,
): MetafilePathMapper {
  const physicalRoot = fs.realpathSync(workingDir);
  return {
    key(candidate) {
      return toPosixPath(path.relative(physicalRoot, path.resolve(candidate)));
    },
    path(key) {
      const absolute = path.resolve(physicalRoot, key);
      return logicalRepositoryPath(absolute, workingDir);
    },
  };
}
