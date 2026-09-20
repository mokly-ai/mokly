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
  const discovered = new Set<string>();
  for (const glob of config.entryGlobs) {
    const matcher = new Minimatch(glob, { dot: true });
    const root = path.resolve(config.repoRoot, globStablePrefix(glob));
    const deniedRoots: string[] = [];
    let matched = 0;
    for (const candidate of walkEntryCandidates(root, deniedRoots, config)) {
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
    const reason = entryModuleDenial(module, config);
    if (reason) throw entryModuleError(module, config);
  }
  return modules;
}

/** List regular files below a root without following links or private trees. */
function walkEntryCandidates(
  root: string,
  deniedRoots: string[],
  config: Pick<ResolvedConfig, "entryGlobs" | "repoRoot" | "review">,
): string[] {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const candidate = path.join(root, entry.name);
      if (entry.isDirectory()) {
        if (isReviewOutputDirectory(candidate, config.review.outDir)) return [];
        if (isDeniedSourceSegment(entry.name)) {
          deniedRoots.push(candidate);
          return [];
        }
        return walkEntryCandidates(candidate, deniedRoots, config);
      }
      return entry.isFile() ? [candidate] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function entryModuleDenial(
  module: string,
  config: Pick<ResolvedConfig, "entryGlobs" | "repoRoot" | "review">,
): string | undefined {
  if (isBaselineCachePath(module, config.repoRoot))
    return `is inside the private ${MOKLY_CACHE} directory`;
  const real = projectRealPath(module);
  const realRepoRoot = fs.realpathSync(config.repoRoot);
  if (!isInside(config.repoRoot, module) || !isInside(realRepoRoot, real))
    return "resolves outside repoRoot through a symlink";
  const outDir = config.review.outDir;
  if (isInside(outDir, module) || isInside(projectRealPath(outDir), real))
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

/** Match the configured Review directory by lexical or projected identity. */
function isReviewOutputDirectory(candidate: string, outDir: string): boolean {
  return (
    path.resolve(candidate) === path.resolve(outDir) ||
    projectRealPath(candidate) === projectRealPath(outDir)
  );
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
  config: Pick<ResolvedConfig, "entryGlobs" | "repoRoot" | "review">,
): MoklyError {
  const reason = entryModuleDenial(module, config);
  return new MoklyError(
    "config-invalid",
    `entry module ${toPosixPath(path.relative(config.repoRoot, module))} ${reason ?? "is denied"}`,
  );
}
