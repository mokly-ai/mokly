import fs from "node:fs";
import path from "node:path";

import { Minimatch } from "minimatch";

import { compareCodeUnits } from "../../config/path_order.js";
import { isInside, toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import {
  blocksRequiredInput,
  packageOwnedRoots,
  packageOwnedPath,
  type PackageOwnedRoots,
  type PackageOwnedReason,
} from "../package_owned_paths.js";

/** Work shared by inventory ordering, root projection and directory expansion. */
export interface DependencyWork {
  /** Sort the supplied array in place and return that array. */
  sort<Value>(
    values: Value[],
    compare: (first: Value, second: Value) => number,
  ): Value[];
  projectRoots(config: ResolvedConfig): PackageOwnedRoots;
  compileGlob(glob: string): Pick<Minimatch, "match">;
}

const dependencyWork: DependencyWork = {
  sort: (values, compare) => values.sort(compare),
  projectRoots: packageOwnedRoots,
  compileGlob: (glob) => new Minimatch(glob, { dot: true, nocase: false }),
};

/** Keep logical/physical classification stable and reusable throughout one load. */
export interface DependencyPathCache {
  readonly reasons: Map<string, PackageOwnedReason | undefined>;
  readonly roots: PackageOwnedRoots;
  readonly work: DependencyWork;
}

/** Share fixed root projections and path decisions throughout one collection. */
export function createDependencyPathCache(
  config: ResolvedConfig,
  work: DependencyWork = dependencyWork,
): DependencyPathCache {
  return { reasons: new Map(), roots: work.projectRoots(config), work };
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
  const matcher = cache.work.compileGlob(glob);
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
    for (const entry of cache.work.sort(
      fs.readdirSync(current, { withFileTypes: true }),
      (first, second) => compareCodeUnits(first.name, second.name),
    )) {
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
  return cache.work.sort(matches, compareCodeUnits);
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
