import fs from "node:fs";
import path from "node:path";

import { minimatch } from "minimatch";

import { isBaselineCachePath } from "../config/cache_paths.js";
import { globStablePrefix } from "../config/entry_globs.js";
import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";
import { isDeniedSourceSegment } from "../config/private_directories.js";
import type { ResolvedConfig } from "../config/types.js";
import { isExportIgnoredPath } from "../export/ignored.js";

import type { WatchDirectoryStatus } from "./watch_events.js";

/** Stable prefixes of every entry glob, watched so new entry modules are found. */
export function entryGlobRoots(config: ResolvedConfig): string[] {
  return [
    ...new Set(
      config.entryGlobs.map((glob) =>
        path.resolve(config.repoRoot, globStablePrefix(glob)),
      ),
    ),
  ];
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
  return (
    matchingGlobs.length > 0 &&
    !isDiscoveryDeniedEntryPath(absolute, matchingGlobs, config, directory)
  );
}

/** Return whether package-owned output should be pruned from a broad watch. */
export function isPackageOwnedIgnoredWatchPath(
  candidate: string,
  config: ResolvedConfig,
  stats?: fs.Stats,
  mode: "traverse" | "event" = "traverse",
  directory: WatchDirectoryStatus = "unknown",
): boolean {
  const absolute = path.resolve(candidate);
  if (isBaselineCachePath(absolute, config.repoRoot)) return true;
  if (!isInside(config.repoRoot, absolute)) return false;
  if (isInside(config.generatedDir, absolute)) return true;
  if (isRequiredWatchPath(absolute, config)) return false;
  const globRoots = entryGlobRoots(config);
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

/** Resolve the finite roots/globs watched for this consumer. */
export function watchTargets(config: ResolvedConfig): string[] {
  const targets = [
    config.configPath,
    ...entryGlobRoots(config),
    ...(config.configSourceFiles ?? []).map((source) =>
      path.resolve(config.repoRoot, source),
    ),
    ...(config.sourceFiles ?? []).map((source) =>
      path.resolve(config.repoRoot, source),
    ),
  ];
  if (config.renderer) targets.push(config.renderer);
  for (const stylesheet of configuredStylesheetPaths(config)) {
    if (!/^https?:\/\//.test(stylesheet))
      targets.push(path.resolve(config.mockupsDir, stylesheet));
  }
  for (const rule of config.watch.rules) {
    targets.push(
      ...rule.paths.map((glob) => globWatchRoot(config.repoRoot, glob)),
    );
  }
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
  const required = [
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
  ];
  return required.some(
    (target) => isInside(candidate, target) || isInside(target, candidate),
  );
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
