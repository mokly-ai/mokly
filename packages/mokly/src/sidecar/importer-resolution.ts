import { realpathSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import type { PluginBuild, ResolveOptions, ResolveResult } from "esbuild";

import type { ModulePaths } from "./module-paths.js";
import { packageDirectory } from "./package-directory.js";
import { inside, logical } from "./path-scope.js";
import { bareSpecifier } from "./specifier.js";

/** Map a bare importer's position into the selected installation repository. */
export function importerDirectory(
  paths: ModulePaths,
  name: string,
  directory: string,
): string {
  if (
    !paths.dependencyRoot ||
    !bareSpecifier(name) ||
    !paths.repositoryOwned(directory)
  )
    return directory;
  if (
    Object.keys(paths.settings.aliases).some(
      (key) => name === key || name.startsWith(key + "/"),
    )
  )
    return directory;
  return path.resolve(
    paths.dependencyRoot,
    logical(paths.sourceRoot, directory),
  );
}

/** Keep source-side tsconfig paths, then resolve packages at the matching tier position. */
export async function resolveImport(
  paths: ModulePaths,
  build: PluginBuild,
  name: string,
  options: ResolveOptions,
): Promise<ResolveResult> {
  const directory = options.resolveDir ?? "";
  const selected = importerDirectory(paths, name, directory);
  const original = await build.resolve(name, options);
  if (selected === directory || original.external) return original;
  if (!original.errors.length && path.isAbsolute(original.path)) {
    const real = await fs.realpath(original.path);
    if (inside(paths.sourceRoot, real)) return original;
  }
  return build.resolve(name, {
    ...options,
    resolveDir: await packageDirectory(paths, selected, name),
  });
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
        return paths.resolveSync(original);
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "MODULE_NOT_FOUND"
      )
        throw error;
    }
    const directory = importerDirectory(paths, name, path.dirname(file));
    const resolver = createRequire(path.join(directory, path.basename(file)));
    return paths.resolveSync(resolver.resolve(name, options));
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
