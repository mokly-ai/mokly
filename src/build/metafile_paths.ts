/** Esbuild metafile keys use the real working directory, even for symlinked roots. */
import fs from "node:fs";
import path from "node:path";

import { isInside, toPosixPath } from "../config/paths.js";

/** Find the metafile key for an existing module or emitted output. */
export function metafileKey(workingDir: string, candidate: string): string {
  const physicalRoot = fs.realpathSync(workingDir);
  return toPosixPath(path.relative(physicalRoot, path.resolve(candidate)));
}

/** Project an esbuild key back under the configured logical working directory. */
export function metafilePath(workingDir: string, key: string): string {
  const physicalRoot = fs.realpathSync(workingDir);
  const absolute = path.resolve(physicalRoot, key);
  return isInside(workingDir, absolute)
    ? absolute
    : isInside(physicalRoot, absolute)
      ? path.resolve(workingDir, path.relative(physicalRoot, absolute))
      : absolute;
}
