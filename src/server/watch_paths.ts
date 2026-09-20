import path from "node:path";

import { minimatch } from "minimatch";

import { isOwned } from "../build/ownership.js";
import { isBaselineCachePath } from "../config/cache_paths.js";
import { globStablePrefix, isEntryModuleName } from "../config/entry_globs.js";
import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { isExportIgnoredPath } from "../export/ignored.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

const IGNORED_DIRECTORY_NAMES = new Set([
  ".context",
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "target",
  "test-results",
]);
const IGNORED_TEMPORARY_PREFIXES = [".mokly-review-", ".mokly-write-"] as const;
const DISCOVERY_PRIVATE_DIRECTORY_NAMES = new Set([".git", "node_modules"]);

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
): boolean {
  if (!isInside(config.repoRoot, absolute)) return false;
  if (isDiscoveryDeniedEntryPath(absolute, config)) return false;
  const relative = toPosixPath(path.relative(config.repoRoot, absolute));
  return (
    isEntryModuleName(relative) &&
    config.entryGlobs.some((glob) => minimatch(relative, glob, { dot: true }))
  );
}

/** Return whether package-owned output should be pruned from a broad watch. */
export function isPackageOwnedIgnoredWatchPath(
  candidate: string,
  config: ResolvedConfig,
  mode: "traverse" | "event" = "traverse",
): boolean {
  const absolute = path.resolve(candidate);
  if (isBaselineCachePath(absolute, config.repoRoot)) return true;
  if (!isInside(config.repoRoot, absolute)) return false;
  if (isRequiredWatchPath(absolute, config)) return false;
  const globRoots = entryGlobRoots(config);
  if (globRoots.some((root) => isInside(absolute, root))) return false;
  if (isGeneratedOutputPath(absolute, config)) return true;
  if (isExportIgnoredPath(absolute, config.repoRoot, mode)) return true;
  if (isInside(config.review.outDir, absolute)) return true;
  const relativeRoot = deepestContainingRoot(absolute, globRoots);
  const parts = path
    .relative(relativeRoot ?? config.repoRoot, absolute)
    .split(path.sep);
  return parts.some(
    (part) =>
      IGNORED_DIRECTORY_NAMES.has(part) ||
      IGNORED_TEMPORARY_PREFIXES.some((prefix) => part.startsWith(prefix)),
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

function isGeneratedOutputPath(
  candidate: string,
  config: ResolvedConfig,
): boolean {
  if (!isInside(config.mockupsDir, candidate)) return false;
  const relative = toPosixPath(path.relative(config.mockupsDir, candidate));
  return relative === MANIFEST_NAME || isOwned(candidate, config);
}

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

function deepestContainingRoot(
  candidate: string,
  roots: readonly string[],
): string | undefined {
  return roots
    .filter((root) => isInside(root, candidate))
    .sort((left, right) => right.length - left.length)[0];
}

function isDiscoveryDeniedEntryPath(
  candidate: string,
  config: ResolvedConfig,
): boolean {
  if (isBaselineCachePath(candidate, config.repoRoot)) return true;
  if (isInside(config.review.outDir, candidate)) return true;
  try {
    const realRepoRoot = projectRealPath(config.repoRoot);
    const realCandidate = projectRealPath(candidate);
    if (!isInside(realRepoRoot, realCandidate)) return true;
    if (isInside(projectRealPath(config.review.outDir), realCandidate))
      return true;
    return path
      .relative(realRepoRoot, realCandidate)
      .split(path.sep)
      .some((part) => DISCOVERY_PRIVATE_DIRECTORY_NAMES.has(part));
  } catch {
    return true;
  }
}
