import fs from "node:fs";
import path from "node:path";

import { isBaselineCachePath } from "../config/cache_paths.js";
import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";
import { isDeniedSourceSegment } from "../config/private_directories.js";
import type { ResolvedConfig } from "../config/types.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

import { isOwned } from "./ownership.js";
import { isGeneratedRoute } from "./styles/routes.js";

/** Reasons a consumer path cannot be discovered through a broad walk. */
export type PackageOwnedReason =
  "generated" | "review" | "cache" | "denied" | "outside";

/** Generated output, Review output and cache outrank explicitly required inputs. */
export function blocksRequiredInput(
  reason: PackageOwnedReason | undefined,
  required: boolean,
): boolean {
  return reason !== undefined && (reason !== "denied" || !required);
}

/** Classify a path by both its authored name and projected physical location. */
export function packageOwnedPath(
  candidate: string,
  config: ResolvedConfig,
  directory?: boolean,
  deniedRoot = config.repoRoot,
): PackageOwnedReason | undefined {
  const absolute = path.resolve(candidate);
  if (!isInside(config.repoRoot, absolute)) return "outside";
  if (
    absolute.endsWith(".html") &&
    isInside(config.mockupsDir, absolute) &&
    isOwned(absolute, config)
  )
    return "generated";
  let isDirectory: boolean;
  try {
    isDirectory =
      directory ??
      fs.statSync(absolute, { throwIfNoEntry: false })?.isDirectory() ??
      false;
  } catch {
    return undefined;
  }
  const inspect = (
    pathName: string,
    repoRoot: string,
    mockupsDir: string,
    reviewDir: string,
    sourceRoot: string,
  ): PackageOwnedReason | undefined => {
    if (isInside(mockupsDir, pathName)) {
      const route = toPosixPath(path.relative(mockupsDir, pathName));
      if (route === MANIFEST_NAME || isGeneratedRoute(route))
        return "generated";
      if (!isDirectory && isOwned(pathName, { ...config, mockupsDir }))
        return "generated";
    }
    if (isInside(reviewDir, pathName)) return "review";
    if (isBaselineCachePath(pathName, repoRoot, false)) return "cache";
    if (isInside(sourceRoot, pathName)) {
      const segments = path.relative(sourceRoot, pathName).split(path.sep);
      if (
        segments.slice(0, -1).some(isDeniedSourceSegment) ||
        (isDirectory && isDeniedSourceSegment(segments.at(-1) ?? ""))
      )
        return "denied";
    }
    return undefined;
  };
  const lexical = inspect(
    absolute,
    config.repoRoot,
    config.mockupsDir,
    config.review.outDir,
    deniedRoot,
  );
  if (lexical) return lexical;
  try {
    const physical = projectRealPath(absolute);
    const realRoot = projectRealPath(config.repoRoot);
    if (!isInside(realRoot, physical)) return "outside";
    return inspect(
      physical,
      realRoot,
      projectRealPath(config.mockupsDir),
      projectRealPath(config.review.outDir),
      projectRealPath(deniedRoot),
    );
  } catch (error) {
    if (
      ["ENOENT", "ENOTDIR", "ELOOP", "EACCES"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      return "outside";
    return undefined;
  }
}
