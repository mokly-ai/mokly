import path from "node:path";

import { locatePath } from "./file_locations.js";
import { isInside, projectRealPath } from "./paths.js";

/** Exclude only code physically installed under node_modules, not workspace aliases. */
export function isPackageCode(
  candidate: string,
  repoRoot: string,
  resolved?: { readonly file: string; readonly root: string },
): boolean {
  const location =
    resolved ??
    (() => {
      const known = locatePath(candidate, repoRoot);
      if (known)
        return { file: known.physicalPath, root: projectRealPath(repoRoot) };
      try {
        return {
          file: projectRealPath(candidate),
          root: projectRealPath(repoRoot),
        };
      } catch {
        return undefined;
      }
    })();
  return (
    !!location &&
    (isInside(location.root, location.file)
      ? path
          .relative(location.root, location.file)
          .split(path.sep)
          .includes("node_modules")
      : location.file.split(path.sep).includes("node_modules"))
  );
}
