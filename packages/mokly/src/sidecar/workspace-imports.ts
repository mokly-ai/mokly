import fs from "node:fs";
import path from "node:path";

import type { BuildOptions } from "esbuild";

import { missingFile } from "./file-digests.js";
import type { ModulePaths } from "./module-paths.js";
import { PackageJson, parsePackageJson } from "./package-json.js";
import { ancestorNodeModules, nearestPackage } from "./package-lookup.js";
import { packageMapTargets, packageTarget } from "./package-map.js";
import { inside } from "./path-scope.js";
import { PhysicalInputs } from "./physical-inputs.js";
import { resolutionRequest } from "./resolution-request.js";
import { bareSpecifier, packageName } from "./specifier.js";

interface WorkspaceImport {
  file: string;
  targets: string[];
}

export interface WorkspacePackage {
  root: string;
  installation: string;
  name: string;
  manifest: PackageJson;
  subpath: string;
  retry: boolean;
  lookups: readonly string[];
}

type WorkspaceImportOptions = Pick<
  BuildOptions,
  "absWorkingDir" | "alias" | "nodePaths"
>;

/** Locate the workspace package of a bundled import after one alias substitution. */
export function workspaceImportRequest(
  paths: ModulePaths,
  name: string,
  directory: string,
  options: WorkspaceImportOptions,
  selected?: string,
) {
  const request = resolutionRequest(
    name,
    directory,
    Object.entries(options.alias ?? {}).sort(([a], [b]) => b.length - a.length),
    options.absWorkingDir ?? paths.sourceRoot,
  );
  if (request.kind !== "lookup" || !path.isAbsolute(request.directory)) return;
  const pkg = workspacePackage(
    paths,
    request.name,
    request.directory,
    [...ancestorNodeModules(request.directory), ...(options.nodePaths ?? [])],
    selected,
  );
  if (pkg) return { name: request.name, pkg };
}

/** Find the selected workspace link and the package it reaches on this side. */
export function workspacePackage(
  paths: ModulePaths,
  name: string,
  directory: string,
  roots: Iterable<string>,
  selected?: string,
): WorkspacePackage | undefined {
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
    const real = selected && fs.realpathSync.native(selected);
    if (real && !paths.repositoryOwned(paths.location(real).file)) return;
    const located = packageLocation(
      identifier,
      directory,
      roots,
      lookups,
      real,
    );
    if (!located) return;
    const installation = fs.realpathSync.native(located);
    const mapped = paths.location(installation).file;
    if (!paths.repositoryOwned(mapped)) return;
    const root = fs.realpathSync.native(mapped);
    if (!paths.repositoryOwned(root)) return;
    const mappedPackage = root !== installation;
    const contents = paths.workspaceLookups.manifest(
      path.join(root, "package.json"),
      mappedPackage,
    );
    if (contents == null) return;
    const manifest = parsePackageJson(contents);
    const [manifestName] = manifest.values("name");
    if (typeof manifestName !== "string" || !manifestName) return;
    if (mappedPackage)
      for (const file of lookups) paths.workspaceLookups.packageLookup(file);
    const retry =
      mappedPackage &&
      (selected === undefined ||
        paths.workspaceLookups.installationManifest(
          path.join(located, "package.json"),
        ) !== contents);
    return {
      root,
      installation,
      name: manifestName,
      manifest,
      subpath: "." + name.slice(identifier.length),
      retry,
      lookups,
    };
  } catch {
    // Unsupported or unreadable package data leaves the native lookup in place.
  }
}

function recordPackage(paths: ModulePaths, pkg: WorkspacePackage): void {
  paths.workspaceLookups.metadata(path.join(pkg.root, "package.json"));
  for (const file of pkg.lookups) paths.workspaceLookups.packageLookup(file);
}

/** Exports use native self-reference. Ordinary packages use native directory lookup. */
export function workspaceRequest(pkg: WorkspacePackage): string {
  if (pkg.manifest.values("exports").length === 0)
    return path.resolve(pkg.root, pkg.subpath);
  return pkg.name + pkg.subpath.slice(1);
}

/** A failed native lookup can recover when all declared targets agree. */
export function workspaceImport(
  paths: ModulePaths,
  pkg: WorkspacePackage,
  name: string,
  mainFields: readonly string[],
): WorkspaceImport | undefined {
  const { root, manifest, subpath } = pkg;
  try {
    let source: string | undefined;
    const targets: string[] = [];
    for (const target of buildTargets(manifest, root, subpath, mainFields)) {
      if (/\.d\.[cm]?ts$/.test(target)) continue;
      if (
        !inside(root, target) ||
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
    recordPackage(paths, pkg);
    return { file: paths.observe(source), targets };
  } catch {
    // Unsupported or unreadable package data leaves the native diagnostic in place.
  }
}

/** Match a layout against the unique declared export that reached the native file. */
export function workspaceTarget(
  paths: ModulePaths,
  pkg: WorkspacePackage,
  selected: string,
  nativeRoot: string,
): string {
  const real = fs.realpathSync.native(selected);
  const original = paths.location(real).file;
  try {
    const targets = [
      ...new Set(buildTargets(pkg.manifest, nativeRoot, pkg.subpath, [])),
    ].filter((target) => inside(nativeRoot, target));
    // The ordinary layout and folder rules record same-side canonical selections.
    if (
      pkg.root === pkg.installation &&
      !targets.some(
        (target) => target !== real && existingPath(target) === real,
      )
    )
      return original;
    recordPackage(paths, pkg);
    let declared: string | undefined;
    for (const target of targets) {
      if (paths.workspaceLookups.nativeTarget(target) !== real) continue;
      if (declared !== undefined) return original;
      declared = path.join(pkg.root, path.relative(nativeRoot, target));
    }
    return declared ?? original;
  } catch {
    return original;
  }
}
function packageLocation(
  identifier: string,
  directory: string,
  roots: Iterable<string>,
  lookups: string[],
  selected: string | undefined,
): string | undefined {
  const inputs = new PhysicalInputs();
  const own = nearestPackage(inputs, directory, false, false, true);
  for (let current = directory; ; current = path.dirname(current)) {
    lookups.push(path.join(current, "package.json"));
    if (own?.directory === current || path.dirname(current) === current) break;
  }
  if (
    own?.manifest.values("name")[0] === identifier &&
    own.manifest.values("exports").length > 0 &&
    (!selected || contains(own.directory, selected))
  )
    return own.directory;
  if (!inputs.complete) return;
  for (const root of new Set(roots)) {
    const candidate = path.join(root, identifier);
    lookups.push(path.join(candidate, "package.json"));
    if (selected) {
      if (contains(candidate, selected)) return candidate;
      continue;
    }
    const stat = fs.statSync(candidate, { throwIfNoEntry: false });
    if (stat) return stat.isDirectory() ? candidate : undefined;
  }
}

function contains(directory: string, selected: string): boolean {
  const real = existingPath(directory);
  return real !== undefined && inside(real, selected);
}

function existingPath(file: string): string | undefined {
  try {
    return fs.realpathSync.native(file);
  } catch (error) {
    if (!missingFile(error)) throw error;
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
