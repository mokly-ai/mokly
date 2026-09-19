import fs from "node:fs";
import path from "node:path";

import { Minimatch } from "minimatch";

import { MoklyError } from "../errors.js";

import { isBaselineCachePath, MOKLY_CACHE } from "./cache_paths.js";
import { globStablePrefix, isEntryModuleName } from "./entry_globs.js";
import { isInside, projectRealPath, toPosixPath } from "./paths.js";
import type { ResolvedConfig } from "./types.js";

/** Directories that never hold consumer authoring sources and are not walked. */
const NEVER_SOURCE_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ".git",
  MOKLY_CACHE,
  "node_modules",
]);

/** Resolve every configured entry glob into sorted absolute entry-module paths. */
export function discoverEntryModules(
  config: Pick<ResolvedConfig, "entryGlobs" | "repoRoot" | "review">,
): string[] {
  const discovered = new Set<string>();
  for (const glob of config.entryGlobs) {
    const matcher = new Minimatch(glob, { dot: true });
    const root = path.resolve(config.repoRoot, globStablePrefix(glob));
    let matched = 0;
    for (const candidate of walkEntryCandidates(root)) {
      const relative = toPosixPath(path.relative(config.repoRoot, candidate));
      if (!isEntryModuleName(relative) || !matcher.match(relative)) continue;
      matched += 1;
      discovered.add(candidate);
    }
    if (matched === 0)
      throw new MoklyError(
        "config-invalid",
        `entries glob matches no .mockup.ts or .mockup.tsx module: ${glob}`,
      );
  }
  const modules = [...discovered].sort((left, right) =>
    toPosixPath(path.relative(config.repoRoot, left)).localeCompare(
      toPosixPath(path.relative(config.repoRoot, right)),
    ),
  );
  for (const module of modules) {
    const reason = entryModuleDenial(module, config);
    if (reason)
      throw new MoklyError(
        "config-invalid",
        `entry module ${toPosixPath(path.relative(config.repoRoot, module))} ${reason}`,
      );
  }
  return modules;
}

/** List regular files below a root without following links or private trees. */
function walkEntryCandidates(root: string): string[] {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const candidate = path.join(root, entry.name);
      if (entry.isDirectory())
        return NEVER_SOURCE_DIRECTORY_NAMES.has(entry.name)
          ? []
          : walkEntryCandidates(candidate);
      return entry.isFile() ? [candidate] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function entryModuleDenial(
  module: string,
  config: Pick<ResolvedConfig, "repoRoot" | "review">,
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
  const privateSegment = path
    .relative(realRepoRoot, real)
    .split(path.sep)
    .find((segment) => NEVER_SOURCE_DIRECTORY_NAMES.has(segment));
  if (privateSegment)
    return `is inside a package-owned private directory (${privateSegment})`;
  return undefined;
}
