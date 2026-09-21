import fs from "node:fs";
import path from "node:path";

import { Minimatch } from "minimatch";

import { MoklyError } from "../errors.js";

import { isBaselineCachePath, MOKLY_CACHE } from "./cache_paths.js";
import { globStablePrefix } from "./entry_globs.js";
import { isInside, projectRealPath, toPosixPath } from "./paths.js";
import { isDeniedSourceSegment } from "./private_directories.js";
import type { ResolvedConfig } from "./types.js";

/**
 * Resolve every configured entry glob into sorted absolute entry-module paths.
 * The cache denial remains here for direct callers that bypass config validation.
 */
export function discoverEntryModules(
  config: Pick<ResolvedConfig, "entryGlobs" | "repoRoot" | "review">,
): string[] {
  const reviewOutput: ReviewOutputPaths = {
    lexical: path.resolve(config.review.outDir),
    projected: projectRealPath(config.review.outDir),
  };
  const discovered = new Set<string>();
  for (const glob of config.entryGlobs) {
    const matcher = new Minimatch(glob, { dot: true });
    const root = path.resolve(config.repoRoot, globStablePrefix(glob));
    const deniedRoots: string[] = [];
    let matched = 0;
    for (const candidate of walkEntryCandidates(
      root,
      deniedRoots,
      reviewOutput,
    )) {
      const relative = toPosixPath(path.relative(config.repoRoot, candidate));
      if (!matcher.match(relative)) continue;
      matched += 1;
      discovered.add(candidate);
    }
    if (matched === 0) {
      const notSearched = [...new Set(deniedRoots)]
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
  const modules = [...discovered].sort((left, right) =>
    toPosixPath(path.relative(config.repoRoot, left)).localeCompare(
      toPosixPath(path.relative(config.repoRoot, right)),
    ),
  );
  for (const module of modules) {
    const reason = entryModuleDenial(module, config, reviewOutput);
    if (reason) throw entryModuleError(module, reason, config);
  }
  return modules;
}

/** Review output identities resolved once for one discovery pass. */
interface ReviewOutputPaths {
  readonly lexical: string;
  readonly projected: string;
}

/** List regular files below a root without following links or private trees. */
function walkEntryCandidates(
  root: string,
  deniedRoots: string[],
  reviewOutput: ReviewOutputPaths,
): string[] {
  return readEntryDirectory(root)
    .flatMap((entry) => {
      const candidate = path.join(root, entry.name);
      if (entry.isDirectory()) {
        if (isSkippedEntryDirectory(candidate, reviewOutput)) return [];
        if (isDeniedSourceSegment(entry.name)) {
          deniedRoots.push(candidate);
          return [];
        }
        return walkEntryCandidates(candidate, deniedRoots, reviewOutput);
      }
      return entry.isFile() ? [candidate] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function entryModuleDenial(
  module: string,
  config: Pick<ResolvedConfig, "entryGlobs" | "repoRoot">,
  reviewOutput: ReviewOutputPaths,
): string | undefined {
  if (isBaselineCachePath(module, config.repoRoot))
    return `is inside the private ${MOKLY_CACHE} directory`;
  const real = projectRealPath(module);
  const realRepoRoot = fs.realpathSync(config.repoRoot);
  if (!isInside(config.repoRoot, module) || !isInside(realRepoRoot, real))
    return "resolves outside repoRoot through a symlink";
  if (
    isInside(reviewOutput.lexical, module) ||
    isInside(reviewOutput.projected, real)
  )
    return "is inside review.outDir";
  const globRoot = deepestContainingGlobRoot(module, config);
  const realGlobRoot = projectRealPath(globRoot ?? config.repoRoot);
  const privateSegment = path
    .relative(realGlobRoot, real)
    .split(path.sep)
    .slice(0, -1)
    .find(isDeniedSourceSegment);
  if (privateSegment)
    return `is inside a package-owned private directory (${privateSegment})`;
  return undefined;
}

/** Skip Review output and directories whose identity cannot be projected. */
function isSkippedEntryDirectory(
  candidate: string,
  reviewOutput: ReviewOutputPaths,
): boolean {
  if (path.resolve(candidate) === reviewOutput.lexical) return true;
  try {
    return projectRealPath(candidate) === reviewOutput.projected;
  } catch {
    return true;
  }
}

/** Read a searchable directory, skipping inaccessible or unresolved paths. */
function readEntryDirectory(candidate: string): fs.Dirent[] {
  try {
    const stats = fs.statSync(candidate);
    if (!stats.isDirectory() || (stats.mode & 0o555) === 0) return [];
    return fs.readdirSync(candidate, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Select the most specific configured walk root containing a module. */
function deepestContainingGlobRoot(
  module: string,
  config: Pick<ResolvedConfig, "entryGlobs" | "repoRoot">,
): string | undefined {
  const relative = toPosixPath(path.relative(config.repoRoot, module));
  return config.entryGlobs
    .filter((glob) => new Minimatch(glob, { dot: true }).match(relative))
    .map((glob) => path.resolve(config.repoRoot, globStablePrefix(glob)))
    .filter((root) => isInside(root, module))
    .sort((left, right) => right.length - left.length)[0];
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
