import fs from "node:fs";
import path from "node:path";

import { MoklyError } from "../errors.js";

import { isBaselineCachePath, MOKLY_CACHE } from "./cache_paths.js";
import {
  discoveryPathError,
  isVanishedDirectory,
  isVanishedModule,
  type DiscoveryPaths,
} from "./entry_discovery_paths.js";
import { isInside, projectRealPath, toPosixPath } from "./paths.js";
import { isDeniedSourceSegment } from "./private_directories.js";
import type { ResolvedConfig } from "./types.js";

/** Return null for a vanished or replaced module, a denial reason, or undefined when accepted. */
export function entryModuleDenial(
  module: string,
  paths: DiscoveryPaths,
): string | null | undefined {
  const { repoRoot, realRepoRoot, reviewOutput } = paths;
  try {
    const stats = fs.lstatSync(module);
    if (!stats.isFile()) return null;
  } catch (cause) {
    if (isVanishedModule(cause)) return null;
    throw discoveryPathError(module, repoRoot, cause);
  }
  if (isBaselineCachePath(module, repoRoot))
    return `is inside the private ${MOKLY_CACHE} directory`;
  if (paths.generatedOutput && isInside(paths.generatedOutput.lexical, module))
    return "is inside mokly-generated/";
  let real: string;
  try {
    real = projectRealPath(module);
  } catch (cause) {
    if (isVanishedModule(cause)) return null;
    throw discoveryPathError(module, repoRoot, cause);
  }
  if (!isInside(repoRoot, module) || !isInside(realRepoRoot, real))
    return "resolves outside repoRoot through a symlink";
  if (paths.generatedOutput && isInside(paths.generatedOutput.projected, real))
    return "is inside mokly-generated/";
  if (
    isInside(reviewOutput.lexical, module) ||
    isInside(reviewOutput.projected, real)
  )
    return "is inside review.outDir";
  const realGlobRoot =
    deepestContainingGlobRoot(module, paths)?.projected ?? realRepoRoot;
  const privateSegment = path
    .relative(realGlobRoot, real)
    .split(path.sep)
    .slice(0, -1)
    .find(isDeniedSourceSegment);
  if (privateSegment)
    return `is inside a package-owned private directory (${privateSegment})`;
  paths.realFiles.set(module, real);
  return undefined;
}

/** Skip Review output and record only benign candidate-projection races. */
export function isSkippedEntryDirectory(
  candidate: string,
  paths: DiscoveryPaths,
  skippedRoots: string[],
): boolean {
  if (
    path.resolve(candidate) === paths.reviewOutput.lexical ||
    (paths.generatedOutput &&
      isInside(paths.generatedOutput.lexical, candidate))
  )
    return true;
  try {
    const physical = projectRealPath(candidate);
    return (
      physical === paths.reviewOutput.projected ||
      !!(
        paths.generatedOutput &&
        isInside(paths.generatedOutput.projected, physical)
      )
    );
  } catch (cause) {
    if (!isVanishedDirectory(cause))
      throw discoveryPathError(candidate, paths.repoRoot, cause);
    skippedRoots.push(candidate);
    return true;
  }
}

/** Read a directory, recording disappearance and reporting every other failure. */
export function readEntryDirectory(
  candidate: string,
  skippedRoots: string[],
  repoRoot: string,
): fs.Dirent[] {
  try {
    return fs.readdirSync(candidate, { withFileTypes: true });
  } catch (cause) {
    if (!isVanishedDirectory(cause))
      throw discoveryPathError(candidate, repoRoot, cause);
    skippedRoots.push(candidate);
    return [];
  }
}

/** Select the most specific configured walk root whose glob matches the module. */
function deepestContainingGlobRoot(
  module: string,
  paths: DiscoveryPaths,
): DiscoveryPaths["roots"][number] | undefined {
  return paths.roots
    .filter(
      ({ matchers, root }) =>
        isInside(root, module) &&
        (path.basename(module) === "_folder.json" ||
          matchers.some((matcher) =>
            matcher.match(toPosixPath(path.relative(root, module))),
          )),
    )
    .sort((left, right) => right.root.length - left.root.length)[0];
}

/** Build a typed config error from the shared per-module denial policy. */
export function entryModuleError(
  module: string,
  reason: string,
  config: Pick<ResolvedConfig, "repoRoot">,
): MoklyError {
  return new MoklyError(
    "config-invalid",
    `entry module ${toPosixPath(path.relative(config.repoRoot, module))} ${reason}`,
  );
}
