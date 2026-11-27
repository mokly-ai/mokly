import fs from "node:fs/promises";
import path from "node:path";

import type { PluginBuild, ResolveOptions, ResolveResult } from "esbuild";

import type { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import { bareSpecifier, packageName } from "./specifier.js";

const caches = new WeakMap<ModulePaths, Map<string, Promise<string>>>();

/** Repeat esbuild's lookup inside the package after applying the authored alias once. */
export async function resolveInPackage(
  build: PluginBuild,
  name: string,
  directory: string,
  options: ResolveOptions,
): Promise<ResolveResult> {
  const lookup = { ...options, resolveDir: directory };
  const { alias, conditions, mainFields, platform, resolveExtensions } =
    build.initialOptions;
  if (
    !Object.keys(alias ?? {}).some(
      (key) => name === key || name.startsWith(key + "/"),
    )
  )
    return build.resolve(name, lookup);

  let resolved: ResolveResult | undefined;
  await build.esbuild.build({
    absWorkingDir: directory,
    stdin: { contents: "" },
    bundle: true,
    write: false,
    logLevel: "silent",
    ...(conditions && { conditions }),
    ...(mainFields && { mainFields }),
    ...(platform && { platform }),
    ...(resolveExtensions && { resolveExtensions }),
    plugins: [
      {
        name: "mokly-workspace-package",
        setup(builder) {
          builder.onStart(async () => {
            resolved = await builder.resolve(name, lookup);
          });
        },
      },
    ],
  });
  if (!resolved) throw new Error("workspace package lookup did not run");
  return resolved;
}

/** Map a bare importer's position into the selected installation repository. */
export function importerDirectory(
  paths: ModulePaths,
  name: string,
  directory: string,
): string {
  if (
    !paths.dependencyRoot ||
    !bareSpecifier(name) ||
    !paths.repositoryOwned(directory) ||
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

/** Resolve from a package scope so a working-tree tsconfig cannot remap a base import. */
export function packageDirectory(
  paths: ModulePaths,
  directory: string,
  specifier: string,
): Promise<string> {
  const name = packageName(specifier);
  let cache = caches.get(paths);
  if (!cache) caches.set(paths, (cache = new Map()));
  const key = JSON.stringify([directory, name]);
  let selected = cache.get(key);
  if (!selected) {
    selected = lookup(paths, directory, name);
    cache.set(key, selected);
  }
  return selected;
}

async function lookup(
  paths: ModulePaths,
  directory: string,
  name: string,
): Promise<string> {
  const roots: string[] = [];
  while (paths.dependencyRoot && inside(paths.dependencyRoot, directory)) {
    if (path.basename(directory) !== "node_modules")
      roots.push(path.join(directory, "node_modules"));
    if (directory === paths.dependencyRoot) break;
    directory = path.dirname(directory);
  }
  roots.push(...paths.dependencyRoots);
  const extensions = paths.settings.resolveExtensions.length
    ? paths.settings.resolveExtensions
    : [".tsx", ".ts", ".jsx", ".js", ".css", ".json"];
  for (const root of new Set(roots)) {
    const pkg = path.join(root, name);
    paths.lookupFiles.add(path.join(pkg, "package.json"));
    paths.lookupDirectories.add(root);
    paths.lookupDirectories.add(pkg);
    const information = await stat(pkg);
    if (information?.isDirectory()) return pkg;
    if (information?.isFile()) return root;
    for (const extension of extensions)
      if ((await stat(pkg + extension))?.isFile()) return root;
  }
  return path.join(paths.dependencyRoot!, "node_modules");
}

async function stat(file: string) {
  try {
    return await fs.stat(file);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["ENOENT", "ENOTDIR"].includes(String(error.code))
    )
      return undefined;
    throw error;
  }
}
