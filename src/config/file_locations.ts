import fs from "node:fs";
import path from "node:path";

import { isInside, projectRealPath, toPosixPath } from "./paths.js";

/** Logical and canonical identities confined to the same configured root. */
export interface FileLocation {
  readonly logicalPath: string;
  readonly physicalPath: string;
  readonly relativePath: string;
  readonly physicalRelativePath: string;
}

/** Map a physical path through a logical root, reusing its supplied projection. */
export function logicalRepositoryPath(
  candidate: string,
  repoRoot: string,
  physicalRoot?: string,
): string {
  const absolute = path.resolve(candidate);
  if (isInside(repoRoot, absolute)) return absolute;
  const projectedRoot = physicalRoot ?? projectRealPath(repoRoot);
  return isInside(projectedRoot, absolute)
    ? path.resolve(repoRoot, path.relative(projectedRoot, absolute))
    : absolute;
}

/** Cache root projections for one inventory; reject escaping or dangling links. */
export function createPathLocator(
  root: string,
  repoRoot = root,
): (candidate: string) => FileLocation | undefined {
  let projectedRepo: string | undefined;
  let realRepo: string | undefined;
  let realRoot: string | undefined;
  return (candidate) => {
    try {
      const absolute = path.resolve(candidate);
      if (!isInside(repoRoot, absolute))
        projectedRepo ??= projectRealPath(repoRoot);
      const logicalPath = logicalRepositoryPath(
        absolute,
        repoRoot,
        projectedRepo,
      );
      if (!isInside(repoRoot, root) || !isInside(root, logicalPath)) return;
      realRepo ??= fs.realpathSync(repoRoot);
      realRoot ??= root === repoRoot ? realRepo : fs.realpathSync(root);
      const physicalPath = projectRealPath(logicalPath);
      if (!isInside(realRepo, realRoot) || !isInside(realRoot, physicalPath))
        return;
      return {
        logicalPath,
        physicalPath,
        relativePath: toPosixPath(path.relative(root, logicalPath)),
        physicalRelativePath: toPosixPath(
          path.relative(realRoot, physicalPath),
        ),
      };
    } catch {
      return;
    }
  };
}

/** Locate one path with fresh roots; return undefined for failed lookups. */
export function locatePath(
  candidate: string,
  root: string,
  repoRoot = root,
): FileLocation | undefined {
  return createPathLocator(root, repoRoot)(candidate);
}
