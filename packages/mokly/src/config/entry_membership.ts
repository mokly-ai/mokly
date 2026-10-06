import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { isInside, projectRealPath } from "./paths.js";
import type { ResolvedConfig } from "./types.js";

const lexicalIndexes = new WeakMap<readonly string[], ReadonlySet<string>>();
const physicalIndexes = new WeakMap<
  readonly string[],
  {
    modules: readonly string[];
    paths: ReadonlyMap<string, string>;
    files: ReadonlySet<string>;
  }
>();
const rootIndexes = new WeakMap<readonly string[], readonly string[]>();

/**
 * Match only the resolved source set. Physical membership also accepts projected
 * real paths so symlink aliases cannot expose authored files as public resources.
 */
export function isAuthoredEntryPath(
  candidate: string,
  config: ResolvedConfig,
  physical = false,
): boolean {
  const absolute = path.resolve(candidate);
  const modules =
    config.protectedFiles ?? config.resolvedFiles ?? config.entryModules;
  if (!modules) return false;
  return (
    physical ? physicalIndex(config, modules).files : lexicalIndex(modules)
  ).has(absolute);
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
  const modules =
    config.protectedFiles ?? config.resolvedFiles ?? config.entryModules;
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

/** Share matched-file projections with the full source inventory in this generation. */
export function projectedEntryPaths(
  config: ResolvedConfig,
): ReadonlyMap<string, string> {
  const modules =
    config.protectedFiles ?? config.resolvedFiles ?? config.entryModules;
  return modules ? physicalIndex(config, modules).paths : new Map();
}

function physicalIndex(config: ResolvedConfig, modules: readonly string[]) {
  const key = config.sourceFiles ?? modules;
  let index = physicalIndexes.get(key);
  if (!index || index.modules !== modules) {
    const paths = new Map(
      modules.map((module) => [module, projectRealPath(module)]),
    );
    index = {
      modules,
      paths,
      files: new Set([...paths.keys(), ...paths.values()]),
    };
    physicalIndexes.set(key, index);
  }
  return index;
}
