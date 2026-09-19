import path from "node:path";

import { isInside, projectRealPath } from "./paths.js";
import type { ResolvedConfig } from "./types.js";

const moduleIndexes = new WeakMap<readonly string[], ReadonlySet<string>>();
const rootIndexes = new WeakMap<readonly string[], readonly string[]>();

/**
 * Return whether a path is authored entry source: a resolved entry module, or
 * any file beneath a configured `entriesDir` shorthand directory. The check is
 * lexical on the given path; callers pass a projected real path for aliases.
 */
export function isAuthoredEntryPath(
  candidate: string,
  config: ResolvedConfig,
): boolean {
  const absolute = path.resolve(candidate);
  if (config.entriesDir !== undefined) {
    if (isInside(config.entriesDir, absolute)) return true;
    try {
      if (isInside(projectRealPath(config.entriesDir), absolute)) return true;
    } catch {
      return false;
    }
  }
  const modules = config.entryModules;
  if (!modules) return false;
  let index = moduleIndexes.get(modules);
  if (!index) {
    index = new Set(
      modules.flatMap((module) => [module, projectRealPath(module)]),
    );
    moduleIndexes.set(modules, index);
  }
  return index.has(absolute);
}

/** Directories protected as authored entry roots for output and export boundaries. */
export function entryModuleRoots(config: ResolvedConfig): readonly string[] {
  if (config.entriesDir !== undefined) return [config.entriesDir];
  const modules = config.entryModules;
  if (!modules) return [];
  let roots = rootIndexes.get(modules);
  if (!roots) {
    roots = [...new Set(modules.map((module) => path.dirname(module)))].sort();
    rootIndexes.set(modules, roots);
  }
  return roots;
}
