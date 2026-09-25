import fs from "node:fs";
import path from "node:path";

import { minimatch } from "minimatch";

import {
  blocksRequiredInput,
  packageOwnedPath,
} from "../build/package_owned_paths.js";
import { isBaselineCachePath } from "../config/cache_paths.js";
import { globStablePrefix } from "../config/entry_globs.js";
import { logicalRepositoryPath } from "../config/file_locations.js";
import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";
import { isDeniedSourceSegment } from "../config/private_directories.js";
import type { ResolvedConfig } from "../config/types.js";
import { isExportIgnoredPath } from "../export/ignored.js";

import type { WatchDirectoryStatus } from "./watch_events.js";
import { RequiredWatchIndex } from "./watch_index.js";

const requiredIndexes = new WeakMap<ResolvedConfig, RequiredWatchIndex>();
const globRootIndexes = new WeakMap<ResolvedConfig, readonly string[]>();

/** Stable prefixes of every entry glob, watched so new entry modules are found. */
export function entryGlobRoots(config: ResolvedConfig): string[] {
  const existing = globRootIndexes.get(config);
  if (existing) return [...existing];
  const roots = [
    ...new Set(
      config.entryGlobs.map((glob) =>
        path.resolve(config.repoRoot, globStablePrefix(glob)),
      ),
    ),
  ];
  globRootIndexes.set(config, roots);
  return roots;
}

/** A created or removed discoverable entry module must re-run discovery. */
export function isEntryGlobCandidate(
  absolute: string,
  config: ResolvedConfig,
  directory: WatchDirectoryStatus = "unknown",
): boolean {
  if (!isInside(config.repoRoot, absolute)) return false;
  const relative = toPosixPath(path.relative(config.repoRoot, absolute));
  const matchingGlobs = config.entryGlobs.filter((glob) =>
    minimatch(relative, glob, { dot: true }),
  );
  if (
    matchingGlobs.length === 0 ||
    isDiscoveryDeniedEntryPath(absolute, matchingGlobs, config, directory)
  )
    return false;
  const relativeRoot =
    deepestContainingRoot(
      absolute,
      matchingGlobs.map((glob) =>
        path.resolve(config.repoRoot, globStablePrefix(glob)),
      ),
    ) ?? config.repoRoot;
  const owned = packageOwnedPath(
    absolute,
    config,
    directory === "directory",
    relativeRoot,
  );
  return !blocksRequiredInput(owned, false);
}

/** Return whether package-owned output should be pruned from a broad watch. */
export function isPackageOwnedIgnoredWatchPath(
  candidate: string,
  config: ResolvedConfig,
  stats?: fs.Stats,
  mode: "traverse" | "event" = "traverse",
  directory: WatchDirectoryStatus = "unknown",
): boolean {
  const absolute = logicalRepositoryPath(candidate, config.repoRoot);
  if (isBaselineCachePath(absolute, config.repoRoot)) return true;
  if (!isInside(config.repoRoot, absolute)) return false;
  const globRoots = entryGlobRoots(config);
  const packageRoot =
    deepestContainingRoot(absolute, globRoots) ?? config.repoRoot;
  const owned = packageOwnedPath(
    absolute,
    config,
    stats?.isDirectory() ?? (directory === "directory" ? true : undefined),
    packageRoot,
  );
  const required = isRequiredWatchPath(absolute, config);
  if (blocksRequiredInput(owned, required)) return true;
  if (required) return false;
  if (globRoots.some((root) => isInside(absolute, root))) return false;
  if (isExportIgnoredPath(absolute, config.repoRoot, mode)) return true;
  if (isInside(config.review.outDir, absolute)) return true;
  const relativeRoot = deepestContainingRoot(absolute, globRoots);
  const segments = denialSegments(relativeRoot ?? config.repoRoot, absolute);
  if (segments.slice(0, -1).some(isDeniedSourceSegment)) return true;
  const leaf = segments.at(-1);
  return (
    leaf !== undefined &&
    isDeniedSourceSegment(leaf) &&
    (stats?.isDirectory() ?? isDirectory(candidate, directory))
  );
}

/** Keep a known public alias observable when its symlink temporarily escapes. */
export function isRecoverablePublicResource(
  candidate: string,
  config: ResolvedConfig,
): boolean {
  if (!isInside(config.mockupsDir, candidate)) return false;
  const reason = packageOwnedPath(candidate, config, false);
  return reason === undefined || reason === "outside" || reason === "denied";
}

/** Resolve the finite roots/globs watched for this consumer. */
export function watchTargets(config: ResolvedConfig): string[] {
  const directoryRoots = [
    ...entryGlobRoots(config),
    ...(config.postcssWatchDirectories ?? []).map((entry) => entry.directory),
    ...config.watch.rules.flatMap((rule) =>
      rule.paths.map((glob) => globWatchRoot(config.repoRoot, glob)),
    ),
  ];
  const fileTargets = [
    config.configPath,
    ...(config.configSourceFiles ?? []).map((source) =>
      path.resolve(config.repoRoot, source),
    ),
    ...(config.sourceFiles ?? []).map((source) =>
      path.resolve(config.repoRoot, source),
    ),
  ];
  if (config.renderer) fileTargets.push(config.renderer);
  for (const stylesheet of configuredStylesheetPaths(config)) {
    if (!/^https?:\/\//.test(stylesheet))
      fileTargets.push(path.resolve(config.mockupsDir, stylesheet));
  }
  const targets = [
    ...directoryRoots,
    ...fileTargets.filter(
      (file) => !directoryRoots.some((root) => isInside(root, file)),
    ),
  ];
  return [...new Set(targets)]
    .filter((target) => !isBaselineCachePath(target, config.repoRoot))
    .sort();
}

/** Configured stylesheet roots whose imports are also consumer resources. */
export function configuredStylesheetPaths(config: ResolvedConfig): string[] {
  return config.stylesheets.flatMap((rule) => [
    ...rule.stylesheets,
    ...(rule.lightStylesheets ?? []),
    ...(rule.darkStylesheets ?? []),
  ]);
}

function globWatchRoot(repoRoot: string, glob: string): string {
  const parts = glob.split("/");
  const firstGlob = parts.findIndex((part) => /[*?{[(]/.test(part));
  const stable = firstGlob === -1 ? parts : parts.slice(0, firstGlob);
  return path.resolve(repoRoot, stable.length === 0 ? "." : stable.join("/"));
}

/** Preserve exact configured inputs and the ancestors needed to reach them. */
function isRequiredWatchPath(
  candidate: string,
  config: ResolvedConfig,
): boolean {
  let index = requiredIndexes.get(config);
  if (!index) {
    index = new RequiredWatchIndex(config.repoRoot, [
      config.configPath,
      ...(config.configSourceFiles ?? []).map((source) =>
        path.resolve(config.repoRoot, source),
      ),
      ...(config.renderer ? [config.renderer] : []),
      ...(config.sourceFiles ?? []).map((source) =>
        path.resolve(config.repoRoot, source),
      ),
      ...configuredStylesheetPaths(config).flatMap((stylesheet) =>
        /^https?:\/\//.test(stylesheet)
          ? []
          : [path.resolve(config.mockupsDir, stylesheet)],
      ),
    ]);
    requiredIndexes.set(config, index);
  }
  return index.contains(candidate, config.repoRoot);
}

/** Select the most specific root containing a candidate path. */
function deepestContainingRoot(
  candidate: string,
  roots: readonly string[],
): string | undefined {
  return roots
    .filter((root) => isInside(root, candidate))
    .sort((left, right) => right.length - left.length)[0];
}

/**
 * Apply discovery confinement below the deepest root whose glob matches a path.
 * An unresolvable path fails closed because discovery could not accept it either.
 */
function isDiscoveryDeniedEntryPath(
  candidate: string,
  matchingGlobs: readonly string[],
  config: ResolvedConfig,
  directory: WatchDirectoryStatus,
): boolean {
  if (isBaselineCachePath(candidate, config.repoRoot)) return true;
  if (isInside(config.review.outDir, candidate)) return true;
  const globRoot = deepestContainingRoot(
    candidate,
    matchingGlobs.map((glob) =>
      path.resolve(config.repoRoot, globStablePrefix(glob)),
    ),
  );
  const relativeRoot = globRoot ?? config.repoRoot;
  const lexicalSegments = denialSegments(relativeRoot, candidate);
  if (lexicalSegments.slice(0, -1).some(isDeniedSourceSegment)) return true;
  const lexicalLeaf = lexicalSegments.at(-1);
  let leafIsDirectory: boolean | undefined;
  if (lexicalLeaf !== undefined && isDeniedSourceSegment(lexicalLeaf)) {
    leafIsDirectory = isDirectory(candidate, directory);
    if (leafIsDirectory) return true;
  }
  try {
    const realRepoRoot = projectRealPath(config.repoRoot);
    const realCandidate = projectRealPath(candidate);
    if (!isInside(realRepoRoot, realCandidate)) return true;
    if (isInside(projectRealPath(config.review.outDir), realCandidate))
      return true;
    const realRelativeRoot = projectRealPath(relativeRoot);
    const realSegments = denialSegments(realRelativeRoot, realCandidate);
    if (realSegments.slice(0, -1).some(isDeniedSourceSegment)) return true;
    const realLeaf = realSegments.at(-1);
    return (
      realLeaf !== undefined &&
      isDeniedSourceSegment(realLeaf) &&
      (leafIsDirectory ?? isDirectory(candidate, directory))
    );
  } catch (error) {
    if (isPathResolutionFailure(error)) return true;
    throw error;
  }
}

/** Return path segments whose directory roles must be classified by the caller. */
function denialSegments(root: string, candidate: string): string[] {
  return path
    .relative(root, candidate)
    .split(path.sep)
    .filter((segment) => segment.length > 0);
}

/** Identify an existing directory while treating every lookup failure as a file. */
function isDirectory(
  candidate: string,
  directory: WatchDirectoryStatus,
): boolean {
  if (directory !== "unknown") return directory === "directory";
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/** Return whether a filesystem error means a path could not be resolved. */
function isPathResolutionFailure(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return ["EACCES", "ELOOP", "ENOENT", "ENOTDIR"].includes(code ?? "");
}
