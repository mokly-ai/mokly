import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { isInside, projectRealPath } from "./paths.js";
import type { ResolvedConfig } from "./types.js";

const lexicalIndexes = new WeakMap<readonly string[], ReadonlySet<string>>();
const physicalIndexes = new WeakMap<readonly string[], ReadonlySet<string>>();
const rootIndexes = new WeakMap<readonly string[], readonly string[]>();

/**
 * Return whether a path is authored entry source: a resolved entry module, or
 * any file beneath a configured `entriesDir` shorthand directory. The lexical
 * form touches no filesystem state; the physical form also matches through
 * the projected real paths of the shorthand directory or each entry module,
 * for callers that pass an already-projected candidate.
 */
export function isAuthoredEntryPath(
  candidate: string,
  config: ResolvedConfig,
  physical = false,
): boolean {
  const absolute = path.resolve(candidate);
  if (config.entriesDir !== undefined) {
    if (isInside(config.entriesDir, absolute)) return true;
    if (!physical) return false;
    try {
      return isInside(projectRealPath(config.entriesDir), absolute);
    } catch {
      return false;
    }
  }
  const modules = config.entryModules;
  if (!modules) return false;
  return (physical ? physicalIndex(modules) : lexicalIndex(modules)).has(
    absolute,
  );
}

/** Require registry attribution to name a resolved entry or inventoried input. */
export function isResolvedEntryOrInventoriedSource(
  sourceRelativePath: string,
  config: ResolvedConfig,
): boolean {
  if (!isSafeRepositoryPath(sourceRelativePath)) return false;
  const absolute = path.resolve(config.repoRoot, sourceRelativePath);
  if (!isInside(config.repoRoot, absolute)) return false;
  return (
    (config.entryModules ?? []).includes(absolute) ||
    (config.sourceFiles ?? []).includes(sourceRelativePath)
  );
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

function lexicalIndex(modules: readonly string[]): ReadonlySet<string> {
  let index = lexicalIndexes.get(modules);
  if (!index) {
    index = new Set(modules);
    lexicalIndexes.set(modules, index);
  }
  return index;
}

function physicalIndex(modules: readonly string[]): ReadonlySet<string> {
  let index = physicalIndexes.get(modules);
  if (!index) {
    index = new Set(
      modules.flatMap((module) => [module, projectRealPath(module)]),
    );
    physicalIndexes.set(modules, index);
  }
  return index;
}
