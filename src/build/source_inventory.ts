import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Metafile } from "esbuild";
import { Minimatch } from "minimatch";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import {
  isAuthoredEntryPath,
  projectedEntryPaths,
} from "../config/entry_membership.js";
import { locatePath, type FileLocation } from "../config/file_locations.js";
import { isPackageCode } from "../config/package_code.js";
import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";
import { matchesRootFile } from "../config/root_membership.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import {
  createMetafilePathMapper,
  type MetafilePathMapper,
} from "./metafile_paths.js";
import type { SourceDenial } from "./source_denial.js";
import { GENERATED_DIRECTORY } from "./styles/routes.js";

const RUNTIME_ROOT = path.resolve(
  fileURLToPath(new URL("../", import.meta.url)),
);
const VIEWER_RUNTIME_ROOT = fs.realpathSync(
  path.dirname(fileURLToPath(import.meta.resolve("@mokly/viewer/data"))),
);

/** Names reserved for authoring, including stale helpers no longer imported. */
function isReservedSource(candidate: string): boolean {
  return (
    path.basename(candidate).toLowerCase() === "_folder.json" ||
    /\.source\.(?:html?|[cm]?[jt]sx?)$/i.test(candidate)
  );
}

interface SourceIndex {
  files: Set<string>;
  aliases: string[];
}
const sourceIndexes = new WeakMap<readonly string[], SourceIndex>();
const logicalSourceIndexes = new WeakMap<
  readonly string[],
  ReadonlySet<string>
>();
const exclusionMatchers = new WeakMap<
  readonly string[],
  readonly Minimatch[]
>();

/** Classification exceptions for internal generated metadata. */
export interface SourceClassificationOptions {
  /** Bypass public globs while retaining every authoring-source protection. */
  readonly ignorePublicExclusions?: boolean;
}

/**
 * Return the denial cause, or undefined for a public candidate.
 * Historical readers use no filesystem aliases;
 * Changes resolves exclusion aliases but leaves retargeted source aliases and
 * unresolvable change paths for resource validation.
 */
export function isAuthoringSource(
  candidate: string,
  config: ResolvedConfig,
  aliases: "all" | "exclusions" | "none" = "all",
  options: SourceClassificationOptions = {},
): SourceDenial | undefined {
  if (
    isAuthoredEntryPath(candidate, config) ||
    (aliases !== "none" && matchesRootFile(candidate, config))
  )
    return { kind: "entries" };
  if (isReservedSource(candidate)) return { kind: "reserved" };
  if (isListedSource(candidate, config)) return { kind: "listed" };
  const logicalExclusion = options.ignorePublicExclusions
    ? undefined
    : matchingPublicExclusion(
        candidate,
        config.mockupsDir,
        config.publicExclude,
      );
  if (logicalExclusion !== undefined)
    return { kind: "exclusion", glob: logicalExclusion };
  if (aliases === "none") return;
  let real: string;
  try {
    real = projectRealPath(candidate);
  } catch (error) {
    if (aliases === "exclusions") return;
    throw error;
  }
  const physicalExclusion = options.ignorePublicExclusions
    ? undefined
    : matchingPublicExclusion(
        real,
        projectRealPath(config.mockupsDir),
        config.publicExclude,
      );
  if (physicalExclusion !== undefined)
    return { kind: "exclusion", glob: physicalExclusion };
  if (aliases === "exclusions") return;
  if (
    isAuthoredEntryPath(real, config, true) ||
    matchesRootFile(real, config, true)
  )
    return { kind: "entries" };
  if (isReservedSource(real)) return { kind: "reserved" };
  const index = sourceIndex(config);
  if (
    index.files.has(candidate) ||
    index.files.has(real) ||
    index.aliases.some((alias) => projectRealPath(alias) === real)
  )
    return { kind: "listed" };
}

/** Cache source membership while rechecking live aliases at each lookup. */
function sourceIndex(config: ResolvedConfig): SourceIndex {
  const inventory = config.sourceFiles;
  const cached = inventory && sourceIndexes.get(inventory);
  if (cached) return cached;
  const files = new Set<string>();
  const sourceAliases: string[] = [];
  const matchedPaths = projectedEntryPaths(config);
  for (const source of inventory ?? []) {
    const logical = path.resolve(config.repoRoot, source);
    const physical = matchedPaths.get(logical) ?? projectRealPath(logical);
    files.add(logical);
    files.add(physical);
    if (logical !== physical) sourceAliases.push(logical);
  }
  const index = { files, aliases: sourceAliases };
  if (inventory) sourceIndexes.set(inventory, index);
  return index;
}

function isListedSource(candidate: string, config: ResolvedConfig): boolean {
  const inventory = config.sourceFiles;
  if (!inventory) return false;
  let files = logicalSourceIndexes.get(inventory);
  if (!files) {
    files = new Set(inventory);
    logicalSourceIndexes.set(inventory, files);
  }
  return files.has(toPosixPath(path.relative(config.repoRoot, candidate)));
}

/** Identify the first exclusion matching a mockups-relative path, including defaults. */
export function matchingPublicExclusion(
  candidate: string,
  root: string,
  globs: readonly string[],
): string | undefined {
  if (!isInside(root, candidate)) return;
  const relative = toPosixPath(path.relative(root, candidate));
  let matchers = exclusionMatchers.get(globs);
  if (!matchers) {
    matchers = globs.map(
      (glob) => new Minimatch(glob, { nocase: true, dot: true }),
    );
    exclusionMatchers.set(globs, matchers);
  }
  return matchers.find((matcher) => matcher.match(relative))?.pattern;
}

/** Record actual graph inputs before tree shaking, including both path aliases. */
export function graphSourceFiles(
  metafile: Metafile,
  workingDir: string,
  repoRoot: string,
  mockupsDir: string,
  mapper: MetafilePathMapper = createMetafilePathMapper(workingDir),
): string[] {
  const realRepoRoot = projectRealPath(repoRoot);
  const candidates = Object.keys(metafile.inputs).flatMap((input) => {
    const absolute = mapper.path(input);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return [];
    const real = fs.realpathSync(absolute);
    if (isGraphRuntimePath(real)) return [];
    if (isPackageCode(absolute, repoRoot, { file: real, root: realRepoRoot }))
      return [];
    return [absolute];
  });
  return normalizeSourceFiles(candidates, repoRoot, mockupsDir);
}

/** Locate one repository-owned consumer-graph input under the inventory rule. */
export function graphSourceLocation(
  candidate: string,
  repoRoot: string,
): FileLocation | undefined {
  const location = locatePath(candidate, repoRoot);
  if (!location) return;
  try {
    if (!fs.statSync(location.physicalPath).isFile()) return;
  } catch {
    return;
  }
  if (
    isGraphRuntimePath(location.physicalPath) ||
    isPackageCode(candidate, repoRoot, {
      file: location.physicalPath,
      root: projectRealPath(repoRoot),
    })
  )
    return;
  return location;
}

/** Return whether a resolved graph path belongs to Mokly's own runtime. */
export function isGraphRuntimePath(candidate: string): boolean {
  return (
    isInside(RUNTIME_ROOT, candidate) ||
    isInside(VIEWER_RUNTIME_ROOT, candidate)
  );
}

/** Prove regular in-repository inputs and retain logical and physical identities. */
export function normalizeSourceFiles(
  files: readonly string[],
  repoRoot: string,
  mockupsDir: string,
): string[] {
  const inventory = new Set<string>();
  const reservedRoot = path.join(mockupsDir, GENERATED_DIRECTORY);
  const realReservedRoot = fs
    .lstatSync(reservedRoot, { throwIfNoEntry: false })
    ?.isSymbolicLink()
    ? reservedRoot
    : projectRealPath(reservedRoot);
  for (const file of files) {
    const absolute = path.resolve(repoRoot, file);
    const location = locatePath(absolute, repoRoot);
    if (!location || !fs.statSync(location.physicalPath).isFile())
      throw new MoklyError(
        "build-invalid",
        `authoring input must be a regular file inside repoRoot: ${file}`,
      );
    for (const relative of [
      location.relativePath,
      location.physicalRelativePath,
    ]) {
      const logicalReserved = isInside(reservedRoot, absolute);
      if (logicalReserved || isInside(realReservedRoot, location.physicalPath))
        throw new MoklyError(
          "build-invalid",
          `authoring input is inside mokly-generated/: ${logicalReserved ? location.relativePath : location.physicalRelativePath}; move authored sources outside Mokly's output directory`,
        );
      if (!isSafeRepositoryPath(relative))
        throw new MoklyError(
          "build-invalid",
          `invalid source input: ${relative}`,
        );
      inventory.add(relative);
    }
  }
  return [...inventory].sort();
}
