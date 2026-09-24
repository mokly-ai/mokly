import fs from "node:fs";
import path from "node:path";

import { minimatch } from "minimatch";

import { isInside, projectRealPath, toPosixPath } from "../../config/paths.js";
import { isDeniedSourceSegment } from "../../config/private_directories.js";
import type { ResolvedConfig } from "../../config/types.js";

/** Walk regular matching files, without following symlinks or denied trees. */
export function walkDependencyDirectory(
  directory: string,
  glob: string,
  config: ResolvedConfig,
): readonly string[] {
  const matches: string[] = [];
  const realRoot = projectRealPath(config.repoRoot);
  const visit = (current: string): void => {
    if (isInside(config.review.outDir, current)) return;
    if (
      !isInside(config.repoRoot, current) ||
      !isInside(realRoot, projectRealPath(current))
    )
      return;
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .sort((first, second) => first.name.localeCompare(second.name))) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!isDeniedSourceSegment(entry.name)) visit(candidate);
      } else if (
        entry.isFile() &&
        minimatch(toPosixPath(path.relative(directory, candidate)), glob, {
          dot: true,
          nocase: false,
        })
      )
        matches.push(candidate);
    }
  };
  visit(directory);
  return matches.sort();
}

/** Skip external/denied paths before touching source inventory normalization. */
export function ignoredDependencyPath(
  candidate: string,
  config: ResolvedConfig,
): boolean {
  const absolute = path.resolve(candidate);
  const relative = path.relative(config.repoRoot, absolute);
  if (!isInside(config.repoRoot, absolute)) return true;
  const physical = projectRealPath(absolute);
  const realRepo = projectRealPath(config.repoRoot);
  const physicalRelative = path.relative(realRepo, physical);
  const denied = (value: string) => {
    const segments = value.split(path.sep);
    return (
      segments.slice(0, -1).some(isDeniedSourceSegment) ||
      (isDeniedSourceSegment(segments.at(-1) ?? "") &&
        fs.statSync(absolute, { throwIfNoEntry: false })?.isDirectory())
    );
  };
  return (
    !isInside(realRepo, physical) ||
    denied(relative) ||
    denied(physicalRelative) ||
    isInside(config.review.outDir, absolute)
  );
}
