import { realpathSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import type { PluginBuild, ResolveOptions, ResolveResult } from "esbuild";

import type { ModulePaths } from "./module-paths.js";
import { importerDirectory, packageDirectory } from "./package-directory.js";
import { ancestorNodeModules } from "./package-lookup.js";
import { PackageScope } from "./package-scope.js";
import { inside, logical } from "./path-scope.js";
import { resolutionRequest } from "./resolution-request.js";
import { bareSpecifier } from "./specifier.js";
import { workspaceImport, workspaceRequire } from "./workspace-imports.js";

interface ImportResult extends ResolveResult {
  workspaceSource?: true;
}

/** Keep source-side tsconfig paths, then resolve packages at the matching tier position. */
export async function resolveImport(
  paths: ModulePaths,
  build: PluginBuild,
  name: string,
  options: ResolveOptions,
): Promise<ImportResult> {
  let directory = options.resolveDir ?? "";
  const selected = importerDirectory(paths, name, directory);
  let resolved = await build.resolve(name, options);
  if (selected !== directory && !resolved.external) {
    if (!resolved.errors.length && path.isAbsolute(resolved.path)) {
      const real = await fs.realpath(resolved.path);
      if (inside(paths.sourceRoot, real)) return resolved;
    }
    directory = await packageDirectory(paths, selected, name);
    resolved = await build.resolve(name, { ...options, resolveDir: directory });
  }
  if (!resolved.errors.length || resolved.external || !bareSpecifier(name))
    return resolved;

  const { absWorkingDir, alias, mainFields, nodePaths } = build.initialOptions;
  const request = resolutionRequest(
    name,
    directory,
    Object.entries(alias ?? {}).sort(([a], [b]) => b.length - a.length),
    absWorkingDir ?? paths.sourceRoot,
  );
  if (request.kind !== "lookup" || !path.isAbsolute(request.directory))
    return resolved;
  const source = workspaceImport(
    paths,
    request.name,
    request.directory,
    [...ancestorNodeModules(request.directory), ...(nodePaths ?? [])],
    mainFields ?? ["main", "module"],
  );
  if (source === undefined) return resolved;
  const scope = new PackageScope();
  const effects = await Promise.all(
    source.targets.map((target) => scope.sideEffects(target).catch(() => true)),
  );
  return {
    ...resolved,
    errors: [],
    path: source.file,
    namespace: "file",
    sideEffects: effects.some(Boolean),
    workspaceSource: true,
  };
}

export async function importPath(
  paths: ModulePaths,
  name: string,
  resolved: ImportResult,
): Promise<string> {
  return resolved.workspaceSource
    ? resolved.path
    : paths.resolve(resolved.path, name);
}

export function missingModule(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "MODULE_NOT_FOUND"
  );
}

export function requireSource(
  paths: ModulePaths,
  name: string,
  directory: string,
  resolvers: NodeJS.Require[],
  error: unknown,
  options?: Parameters<NodeJS.RequireResolve>[1],
): string {
  if (!missingModule(error)) throw error;
  const source = workspaceRequire(paths, name, directory, resolvers, options);
  if (source !== undefined) return source;
  throw error;
}

/** Synchronous runtime requires keep source reads local and map bare package lookups. */
export function sideRequire(paths: ModulePaths, file: string): NodeJS.Require {
  file = path.join(realpathSync(path.dirname(file)), path.basename(file));
  const native = createRequire(file);
  const resolve = (
    name: string,
    options?: Parameters<NodeJS.RequireResolve>[1],
  ) => {
    try {
      const original = native.resolve(name, options);
      if (
        !path.isAbsolute(original) ||
        inside(paths.sourceRoot, realpathSync(original))
      )
        return paths.resolveSync(original, name);
    } catch (error) {
      if (!missingModule(error)) throw error;
    }
    const directory = importerDirectory(paths, name, path.dirname(file));
    const resolver = createRequire(path.join(directory, path.basename(file)));
    try {
      return paths.resolveSync(resolver.resolve(name, options), name);
    } catch (error) {
      return requireSource(paths, name, directory, [resolver], error, options);
    }
  };
  const require = Object.assign(
    (name: string) => native(resolve(name)),
    native,
  ) as NodeJS.Require;
  require.resolve = Object.assign(resolve, { paths: native.resolve.paths });
  return require;
}

/** A dependency beneath an importer retains its repository-relative graph name. */
export function dependencyDirectory(
  root: string | undefined,
  file: string,
): string | undefined {
  if (!root || !inside(root, file)) return undefined;
  const parts = logical(root, file).split("/");
  const index = parts.indexOf("node_modules");
  return index < 0 ? undefined : path.join(root, ...parts.slice(0, index + 1));
}
