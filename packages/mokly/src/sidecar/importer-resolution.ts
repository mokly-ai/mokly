import { realpathSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import type { PluginBuild, ResolveOptions, ResolveResult } from "esbuild";

import type { ModulePaths } from "./module-paths.js";
import {
  importerDirectory,
  packageDirectory,
  resolveInPackage,
} from "./package-directory.js";
import { PackageScope } from "./package-scope.js";
import { inside, logical } from "./path-scope.js";
import { bareSpecifier } from "./specifier.js";
import {
  workspaceImport,
  workspaceImportRequest,
  workspacePackage,
  workspaceRequest,
  workspaceTarget,
} from "./workspace-imports.js";
import type { WorkspacePackage } from "./workspace-imports.js";

interface ImportResult extends ResolveResult {
  workspaceSource?: true;
  workspaceTarget?: string;
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
    const local =
      !resolved.errors.length &&
      path.isAbsolute(resolved.path) &&
      inside(paths.sourceRoot, await fs.realpath(resolved.path));
    if (!local) {
      directory = await packageDirectory(paths, selected, name);
      resolved = await build.resolve(name, {
        ...options,
        resolveDir: directory,
      });
    }
  }
  if (
    resolved.external ||
    !bareSpecifier(name) ||
    (!resolved.errors.length &&
      (resolved.namespace !== "file" || !path.isAbsolute(resolved.path)))
  )
    return resolved;

  const request = workspaceImportRequest(
    paths,
    name,
    directory,
    build.initialOptions,
    resolved.errors.length ? undefined : resolved.path,
  );
  if (!request) return resolved;
  const { pkg } = request;
  let nativeRoot = pkg.installation;
  const original = resolved;
  if (pkg.retry) {
    nativeRoot = pkg.root;
    resolved = await resolveInPackage(
      build,
      workspaceRequest(pkg),
      pkg.root,
      options,
    );
    if (!resolved.errors.length && path.isAbsolute(resolved.path))
      paths.workspaceLookups.nativeTarget(resolved.path);
  }
  if (!resolved.errors.length) {
    if (!path.isAbsolute(resolved.path) || resolved.external) return resolved;
    return {
      ...resolved,
      workspaceTarget: workspaceTarget(paths, pkg, resolved.path, nativeRoot),
    };
  }

  const source = workspaceImport(
    paths,
    pkg,
    request.name,
    build.initialOptions.mainFields ?? ["main", "module"],
  );
  if (original.errors.length) resolved = original;
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
    : paths.resolve(resolved.path, name, resolved.workspaceTarget);
}

function errorCode(error: unknown): unknown {
  return error && typeof error === "object" && "code" in error
    ? error.code
    : undefined;
}

function requireSource(
  paths: ModulePaths,
  name: string,
  directory: string,
  resolvers: NodeJS.Require[],
  error: unknown,
  options?: Parameters<NodeJS.RequireResolve>[1],
): string {
  const pkg = workspacePackage(
    paths,
    name,
    directory,
    requireRoots(name, resolvers, options),
  );
  if (!pkg || (!pkg.retry && errorCode(error) !== "MODULE_NOT_FOUND"))
    throw error;
  return retryRequire(paths, pkg, name, error);
}

/** Keep Node's native build when it exists in the selected workspace package. */
export function resolveRequire(
  paths: ModulePaths,
  name: string,
  directory: string,
  resolvers: NodeJS.Require[],
  options?: Parameters<NodeJS.RequireResolve>[1],
): string {
  let missing: unknown;
  for (const resolver of resolvers) {
    let selected: string;
    try {
      selected = resolver.resolve(name, options);
    } catch (error) {
      if (errorCode(error) === "ERR_PACKAGE_PATH_NOT_EXPORTED")
        return requireSource(
          paths,
          name,
          directory,
          [resolver],
          error,
          options,
        );
      if (errorCode(error) !== "MODULE_NOT_FOUND") throw error;
      missing ??= error;
      continue;
    }
    if (!path.isAbsolute(selected) || inside(paths.sourceRoot, selected))
      return paths.resolveSync(selected, name);
    const pkg = workspacePackage(
      paths,
      name,
      directory,
      requireRoots(name, [resolver], options),
      selected,
    );
    if (!pkg) return paths.resolveSync(selected, name);
    if (pkg.retry) return retryRequire(paths, pkg, name);
    return paths.resolveSync(
      selected,
      name,
      workspaceTarget(paths, pkg, selected, pkg.installation),
    );
  }
  return requireSource(paths, name, directory, resolvers, missing, options);
}

function retryRequire(
  paths: ModulePaths,
  pkg: WorkspacePackage,
  name: string,
  original?: unknown,
): string {
  const request = pkg.retry ? workspaceRequest(pkg) : undefined;
  let error = original;
  if (request !== undefined) {
    try {
      const resolver = createRequire(path.join(pkg.root, "package.json"));
      const selected = resolver.resolve(request);
      paths.workspaceLookups.nativeTarget(selected);
      return paths.resolveSync(selected, name);
    } catch (failure) {
      if (errorCode(failure) !== "MODULE_NOT_FOUND") throw failure;
      error = failure;
    }
  }
  const source = workspaceImport(paths, pkg, name, ["main"]);
  if (source !== undefined) return source.file;
  throw error;
}

function requireRoots(
  name: string,
  resolvers: NodeJS.Require[],
  options?: Parameters<NodeJS.RequireResolve>[1],
): string[] {
  const search =
    options?.paths?.map((root) =>
      createRequire(path.resolve(root, "package.json")),
    ) ?? resolvers;
  return search.flatMap((resolver) => resolver.resolve.paths(name) ?? []);
}

/** Synchronous runtime requires keep source reads local and map bare package lookups. */
export function sideRequire(paths: ModulePaths, file: string): NodeJS.Require {
  file = path.join(realpathSync(path.dirname(file)), path.basename(file));
  const local = path.dirname(file);
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
      if (errorCode(error) === "ERR_PACKAGE_PATH_NOT_EXPORTED")
        return requireSource(paths, name, local, [native], error, options);
      if (errorCode(error) !== "MODULE_NOT_FOUND") throw error;
    }
    const directory = importerDirectory(paths, name, local);
    const resolver = createRequire(path.join(directory, path.basename(file)));
    return resolveRequire(paths, name, directory, [resolver], options);
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
