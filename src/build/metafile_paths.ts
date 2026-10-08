/** Esbuild metafile keys use the real working directory, even for symlinked roots. */
import fs from "node:fs";
import path from "node:path";

import { logicalRepositoryPath } from "../config/file_locations.js";
import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";

/** Map one esbuild metafile without resolving its working directory per edge. */
export interface MetafilePathMapper {
  /** Find a key for an authored root or emitted output. */
  key(candidate: string): string;
  /** Project a metafile key to the configured logical working directory. */
  path(key: string): string;
}

/** Cache each working-directory projection for a whole metafile, including symlinks. */
export function createMetafilePathMapper(
  workingDir: string,
): MetafilePathMapper {
  const physicalRoot = fs.realpathSync(workingDir);
  let projectedRoot: string | undefined;
  return {
    key(candidate) {
      return toPosixPath(path.relative(physicalRoot, path.resolve(candidate)));
    },
    path(key) {
      const absolute = path.resolve(physicalRoot, key);
      if (isInside(workingDir, absolute)) return absolute;
      projectedRoot ??= projectRealPath(workingDir);
      return logicalRepositoryPath(absolute, workingDir, projectedRoot);
    },
  };
}
