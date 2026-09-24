import fs from "node:fs";
import path from "node:path";

import { MoklyError } from "../errors.js";

import { isBaselineCachePath, MOKLY_CACHE } from "./cache_paths.js";
import {
  discoveryPaths,
  discoveryPathError,
  type DiscoveryPaths,
  isVanishedDirectory,
  isVanishedModule,
} from "./entry_discovery_paths.js";
import { isInside, projectRealPath, toPosixPath } from "./paths.js";
import { isDeniedSourceSegment } from "./private_directories.js";
import type { ResolvedConfig } from "./types.js";

/**
 * Resolve every configured entry glob into sorted absolute entry-module paths.
 * The cache denial remains here for direct callers that bypass config validation.
 */
export function discoverEntryModules(
  config: Pick<ResolvedConfig, "entryGlobs" | "repoRoot" | "review"> &
    Partial<Pick<ResolvedConfig, "mockupsDir">>,
): string[] {
  const paths = discoveryPaths(config);
  const discovered = new Set<string>();
  const vanished = new Set<string>();
  for (const { glob, matcher, root } of paths.globs) {
    const deniedRoots: string[] = [];
    const skippedRoots: string[] = [];
    let matched = 0;
    for (const candidate of walkEntryCandidates(
      root,
      deniedRoots,
      skippedRoots,
      paths,
    )) {
      const relative = toPosixPath(path.relative(config.repoRoot, candidate));
      if (!matcher.match(relative)) continue;
      if (vanished.has(candidate)) {
        skippedRoots.push(candidate);
        continue;
      }
      if (!discovered.has(candidate)) {
        const reason = entryModuleDenial(candidate, paths);
        if (reason === null) {
          vanished.add(candidate);
          skippedRoots.push(candidate);
          continue;
        }
        if (reason) throw entryModuleError(candidate, reason, config);
      }
      matched += 1;
      discovered.add(candidate);
    }
    if (matched === 0) {
      const notSearched = [...new Set([...deniedRoots, ...skippedRoots])]
        .map((deniedRoot) =>
          toPosixPath(path.relative(config.repoRoot, deniedRoot)),
        )
        .sort((left, right) => left.localeCompare(right));
      throw new MoklyError(
        "config-invalid",
        `entries glob matches no module: ${glob}${notSearched.length > 0 ? `; not searched: ${notSearched.join(", ")}` : ""}`,
      );
    }
  }
  return [...discovered].sort((left, right) =>
    toPosixPath(path.relative(config.repoRoot, left)).localeCompare(
      toPosixPath(path.relative(config.repoRoot, right)),
    ),
  );
}

/** List regular files below a root without following links or private trees. */
function walkEntryCandidates(
  root: string,
  deniedRoots: string[],
  skippedRoots: string[],
  paths: DiscoveryPaths,
): string[] {
  return readEntryDirectory(root, skippedRoots, paths.repoRoot)
    .flatMap((entry) => {
      const candidate = path.join(root, entry.name);
      if (entry.isDirectory()) {
        if (isDeniedSourceSegment(entry.name)) {
          deniedRoots.push(candidate);
          return [];
        }
        if (isSkippedEntryDirectory(candidate, paths, skippedRoots)) return [];
        return walkEntryCandidates(candidate, deniedRoots, skippedRoots, paths);
      }
      return entry.isFile() ? [candidate] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

/** Return null for a vanished or replaced module, a denial reason, or undefined when accepted. */
function entryModuleDenial(
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
  return undefined;
}

/** Skip Review output and record only benign candidate-projection races. */
function isSkippedEntryDirectory(
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
function readEntryDirectory(
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
): DiscoveryPaths["globs"][number] | undefined {
  const relative = toPosixPath(path.relative(paths.repoRoot, module));
  return paths.globs
    .filter(
      ({ matcher, root }) => matcher.match(relative) && isInside(root, module),
    )
    .sort((left, right) => right.root.length - left.root.length)[0];
}

/** Build a typed config error from the shared per-module denial policy. */
function entryModuleError(
  module: string,
  reason: string,
  config: Pick<ResolvedConfig, "repoRoot">,
): MoklyError {
  return new MoklyError(
    "config-invalid",
    `entry module ${toPosixPath(path.relative(config.repoRoot, module))} ${reason}`,
  );
}
