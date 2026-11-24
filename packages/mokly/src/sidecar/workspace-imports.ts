import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { ModulePaths } from "./module-paths.js";
import { PackageJson, parsePackageJson } from "./package-json.js";
import { nearestPackage } from "./package-lookup.js";
import { packageMapTargets, packageTarget } from "./package-map.js";
import { inside } from "./path-scope.js";
import { PhysicalInputs } from "./physical-inputs.js";
import { bareSpecifier, packageName } from "./specifier.js";

interface WorkspaceImport {
  file: string;
  targets: string[];
}

/** A failed native lookup can recover when all declared targets agree. */
export function workspaceImport(
  paths: ModulePaths,
  name: string,
  directory: string,
  roots: Iterable<string>,
  mainFields: readonly string[],
): WorkspaceImport | undefined {
  if (!bareSpecifier(name) || !path.isAbsolute(directory)) return;
  const identifier = packageName(name);
  if (
    (identifier.startsWith("@") && !identifier.includes("/")) ||
    name.includes("\\") ||
    name.split("/").some((part) => !part || part === "." || part === "..")
  )
    return;

  const lookups: string[] = [];
  try {
    const located = packageLocation(identifier, directory, roots, lookups);
    if (!located) return;
    const physical = fs.realpathSync.native(located);
    const mapped = paths.location(physical).file;
    if (!paths.repositoryOwned(mapped)) return;
    const pkg = fs.realpathSync.native(mapped);
    if (!paths.repositoryOwned(pkg)) return;
    const file = path.join(pkg, "package.json");
    const real = paths.workspaceLookups.regular(file);
    if (!real) return;
    const manifest = parsePackageJson(paths.workspaceLookups.read(real));
    const subpath =
      name === identifier ? "." : "." + name.slice(identifier.length);

    let source: string | undefined;
    const targets: string[] = [];
    for (const target of buildTargets(manifest, pkg, subpath, mainFields)) {
      if (/\.d\.[cm]?ts$/.test(target)) continue;
      if (
        !inside(pkg, target) ||
        !paths.repositoryOwned(target) ||
        paths.configuredFile(target) ||
        !paths.workspaceLookups.buildTarget(target)
      )
        return;
      const candidate = paths.workspaceSource(target, name);
      if (!candidate || (source !== undefined && source !== candidate)) return;
      source = candidate;
      targets.push(target);
    }
    if (!source) return;
    paths.workspaceLookups.metadata(file);
    for (const lookup of lookups) paths.workspaceLookups.packageLookup(lookup);
    return { file: paths.observe(source), targets };
  } catch {
    // Unsupported or unreadable package data leaves the native diagnostic in place.
  }
}

function packageLocation(
  identifier: string,
  directory: string,
  roots: Iterable<string>,
  lookups: string[],
): string | undefined {
  const inputs = new PhysicalInputs();
  const own = nearestPackage(inputs, directory, false, false, true);
  for (let current = directory; ; current = path.dirname(current)) {
    lookups.push(path.join(current, "package.json"));
    if (own?.directory === current || path.dirname(current) === current) break;
  }
  if (
    own?.manifest.values("name")[0] === identifier &&
    own.manifest.values("exports").length > 0
  )
    return own.directory;
  if (!inputs.complete) return;
  for (const root of new Set(roots)) {
    const candidate = path.join(root, identifier);
    lookups.push(path.join(candidate, "package.json"));
    const stat = fs.statSync(candidate, { throwIfNoEntry: false });
    if (stat) return stat.isDirectory() ? candidate : undefined;
  }
}

function* buildTargets(
  manifest: PackageJson,
  pkg: string,
  subpath: string,
  mainFields: readonly string[],
): Generator<string> {
  const [exports] = manifest.values("exports");
  if (exports === undefined) {
    if (subpath === ".")
      for (const field of mainFields) {
        const [target] = manifest.values(field);
        if (typeof target === "string" && target)
          yield path.resolve(pkg, target);
      }
    return;
  }
  const keys =
    exports instanceof PackageJson ? exports.entries.map(([key]) => key) : [];
  if (keys.some((key) => key.startsWith("."))) {
    if (keys.some((key) => !key.startsWith("."))) return;
  } else if (subpath !== ".") return;
  for (const { target, selected } of packageMapTargets(
    exports,
    subpath,
    undefined,
    0,
    true,
    true,
  )) {
    if (!selected) continue;
    if (!target.startsWith("./"))
      throw new Error("invalid workspace export target");
    yield packageTarget(pkg, target);
  }
}

export function workspaceRequire(
  paths: ModulePaths,
  name: string,
  directory: string,
  resolvers: NodeJS.Require[],
  options?: Parameters<NodeJS.RequireResolve>[1],
): string | undefined {
  const search =
    options?.paths?.map((root) =>
      createRequire(path.resolve(root, "package.json")),
    ) ?? resolvers;
  return workspaceImport(
    paths,
    name,
    directory,
    search.flatMap((resolver) => resolver.resolve.paths(name) ?? []),
    ["main"],
  )?.file;
}
