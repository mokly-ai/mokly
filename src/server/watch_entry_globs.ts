import path from "node:path";

import { minimatch } from "minimatch";

import { globStablePrefix, isEntryModuleName } from "../config/entry_globs.js";
import { isInside, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

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

/** A created or removed entry module under a glob root must re-run discovery. */
export function isEntryGlobCandidate(
  absolute: string,
  config: ResolvedConfig,
): boolean {
  if (!isInside(config.repoRoot, absolute)) return false;
  const relative = toPosixPath(path.relative(config.repoRoot, absolute));
  return (
    isEntryModuleName(relative) &&
    config.entryGlobs.some((glob) => minimatch(relative, glob, { dot: true }))
  );
}
