import fs from "node:fs";
import path from "node:path";

import { Minimatch } from "minimatch";

import { compareCodeUnits } from "../../config/path_order.js";
import { isInside, projectRealPath, toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import {
  blocksRequiredInput,
  packageOwnedRoots,
  packageOwnedPath,
  type PackageOwnedRoots,
  type PackageOwnedReason,
} from "../package_owned_paths.js";

/** Keep logical/physical classification stable and reusable throughout one load. */
export interface DependencyPathCache {
  readonly physicalPaths: Map<string, string>;
  readonly reasons: Map<string, PackageOwnedReason | undefined>;
  readonly roots: PackageOwnedRoots;
}

/** Share fixed root projections and path decisions throughout one collection. */
export function createDependencyPathCache(
  config: ResolvedConfig,
): DependencyPathCache {
  return {
    physicalPaths: new Map(),
    reasons: new Map(),
    roots: packageOwnedRoots(config),
  };
}

/** Reuse physical projections only within the current dependency collection. */
export function dependencyPhysicalPath(
  candidate: string,
  cache: DependencyPathCache,
): string {
  let physical = cache.physicalPaths.get(candidate);
  if (physical === undefined) {
    physical = projectRealPath(candidate);
    cache.physicalPaths.set(candidate, physical);
  }
  return physical;
}

/** Memoize one path's ownership for the duration of a dependency inventory. */
export function dependencyOwnership(
  candidate: string,
  config: ResolvedConfig,
  cache: DependencyPathCache,
  directory?: boolean,
): PackageOwnedReason | undefined {
  const key = `${directory === undefined ? "?" : directory ? "d" : "f"}\0${candidate}`;
  if (cache.reasons.has(key)) return cache.reasons.get(key);
  const reason = packageOwnedPath(
    candidate,
    config,
    directory,
    config.repoRoot,
    cache.roots,
    (file) => dependencyPhysicalPath(file, cache),
  );
  cache.reasons.set(key, reason);
  return reason;
}

/** Walk regular matching files, without following symlinks or denied trees. */
export function walkDependencyDirectory(
  directory: string,
  glob: string,
  config: ResolvedConfig,
  cache: DependencyPathCache = createDependencyPathCache(config),
): readonly string[] {
  const matches: string[] = [];
  const matcher = new Minimatch(glob, { dot: true, nocase: false });
  const realMockupsDir = cache.roots.mockups;
  const visit = (current: string): void => {
    const owned = dependencyOwnership(current, config, cache, true);
    if (
      blocksRequiredInput(owned, false) &&
      (owned !== "generated" || config.generatedOutput === "derived")
    )
      return;
    const insideMockups =
      isInside(config.mockupsDir, current) ||
      isInside(realMockupsDir, fs.realpathSync.native(current));
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .sort((first, second) => compareCodeUnits(first.name, second.name))) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(candidate);
      } else if (
        entry.isFile() &&
        matcher.match(toPosixPath(path.relative(directory, candidate))) &&
        (!insideMockups ||
          !["review", "cache", "denied", "package", "outside"].includes(
            dependencyOwnership(candidate, config, cache, false) ?? "",
          ))
      ) {
        matches.push(candidate);
      }
    }
  };
  visit(directory);
  return matches.sort(compareCodeUnits);
}

/** Skip external/denied paths before touching source inventory normalization. */
export function ignoredDependencyPath(
  candidate: string,
  config: ResolvedConfig,
  cache: DependencyPathCache = createDependencyPathCache(config),
): boolean {
  const owned = dependencyOwnership(candidate, config, cache);
  return blocksRequiredInput(owned, true) && owned !== "generated";
}
