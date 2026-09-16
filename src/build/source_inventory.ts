import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Metafile } from "esbuild";
import { Minimatch } from "minimatch";

import { locatePath } from "../config/file_locations.js";
import {
  isInside,
  isSafeRepositoryPath,
  projectRealPath,
  toPosixPath,
} from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import type { SourceDenial } from "./source_denial.js";

/** Names reserved for authoring, including stale helpers no longer imported. */
function isReservedSource(candidate: string): boolean {
  return /\.source\.(?:html?|[cm]?[jt]sx?)$/i.test(candidate);
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
  if (isInside(config.entriesDir, candidate)) return { kind: "entries" };
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
  if (isInside(projectRealPath(config.entriesDir), real))
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
  for (const source of inventory ?? []) {
    const logical = path.resolve(config.repoRoot, source);
    const physical = projectRealPath(logical);
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

function matchingPublicExclusion(
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
): string[] {
  const runtime = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
  const candidates = Object.keys(metafile.inputs).flatMap((input) => {
    const absolute = path.resolve(workingDir, input);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return [];
    const real = fs.realpathSync(absolute);
    if (isInside(runtime, real)) return [];
    if (real.split(path.sep).includes("node_modules")) return [];
    return [absolute];
  });
  return normalizeSourceFiles(candidates, repoRoot);
}

/** Prove regular in-repository inputs and retain logical and physical identities. */
export function normalizeSourceFiles(
  files: readonly string[],
  repoRoot: string,
): string[] {
  const inventory = new Set<string>();
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
