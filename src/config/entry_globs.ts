import path from "node:path";

import { braceExpand } from "minimatch";

import { MoklyError } from "../errors.js";

import { isBaselineCachePath, MOKLY_CACHE } from "./cache_paths.js";
import { isInside, resolveInside, toPosixPath } from "./paths.js";
import { requireString, validateStringArray } from "./rules.js";

/** Glob appended to an `entriesDir` shorthand directory. */
const ENTRIES_DIR_GLOB = "**/*.mockup.{ts,tsx}";

/** Validated, repository-relative entry globs with their configured origin. */
export interface EntryGlobs {
  /** Repository-relative POSIX globs in declaration order. */
  readonly globs: readonly string[];
  /** Absolute shorthand directory when `entriesDir` supplied the single glob. */
  readonly entriesDir?: string;
}

/** Resolve exactly one of `entries` or `entriesDir` into repository-relative globs. */
export function resolveEntryGlobs(
  input: { entries?: unknown; entriesDir?: unknown },
  repoRoot: string,
  configDir: string,
): EntryGlobs {
  const hasEntries = input.entries !== undefined;
  const hasEntriesDir = input.entriesDir !== undefined;
  if (hasEntries && hasEntriesDir)
    throw new MoklyError(
      "config-invalid",
      "entries and entriesDir are mutually exclusive; configure one of them",
    );
  if (!hasEntries && !hasEntriesDir)
    throw new MoklyError(
      "config-invalid",
      "entries must list at least one repository-relative glob, or entriesDir must name a directory",
    );
  if (hasEntriesDir) {
    requireString(input.entriesDir, "entriesDir");
    const entriesDir = resolveInside(
      repoRoot,
      configDir,
      input.entriesDir,
      "entriesDir",
    );
    if (isBaselineCachePath(entriesDir, repoRoot))
      throw new MoklyError(
        "config-invalid",
        `entriesDir must not be inside ${MOKLY_CACHE}`,
      );
    const relative = path.relative(repoRoot, entriesDir);
    const prefix = relative === "" ? "" : `${toPosixPath(relative)}/`;
    return { globs: [`${prefix}${ENTRIES_DIR_GLOB}`], entriesDir };
  }
  const globs = validateStringArray(
    input.entries as readonly string[],
    "entries",
  ).map((glob) => validateEntryGlob(glob, repoRoot));
  if (globs.length === 0)
    throw new MoklyError("config-invalid", "entries must not be empty");
  const seen = new Set<string>();
  for (const glob of globs) {
    if (seen.has(glob))
      throw new MoklyError("config-invalid", `duplicate entries glob: ${glob}`);
    seen.add(glob);
  }
  return { globs };
}

/** Leading literal segments before the first wildcard, used as a walk root. */
export function globStablePrefix(glob: string): string {
  const parts = glob.split("/");
  const firstGlob = parts.findIndex((part) => /[*?{[(]/.test(part));
  return (
    firstGlob === -1 ? parts.slice(0, -1) : parts.slice(0, firstGlob)
  ).join("/");
}

function validateEntryGlob(glob: string, repoRoot: string): string {
  const normalized = glob.replaceAll("\\", "/").replace(/^\.\//, "");
  let alternatives: string[];
  try {
    alternatives = braceExpand(normalized);
  } catch {
    throw invalidGlob(glob);
  }
  if (!alternatives.every(safeGlob) || !safeGlob(normalized))
    throw invalidGlob(glob);
  const prefixRoot = path.resolve(repoRoot, globStablePrefix(normalized));
  if (
    !isInside(repoRoot, prefixRoot) ||
    isBaselineCachePath(prefixRoot, repoRoot)
  )
    throw new MoklyError(
      "config-invalid",
      `entries glob must stay inside repoRoot and outside ${MOKLY_CACHE}: ${glob}`,
    );
  return normalized;
}

function safeGlob(glob: string): boolean {
  return (
    glob.trim().length > 0 &&
    !/^[!#]/.test(glob) &&
    !glob.startsWith("/") &&
    !/[:\0]/.test(glob) &&
    glob
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function invalidGlob(glob: string): MoklyError {
  return new MoklyError(
    "config-invalid",
    `entries requires safe relative POSIX globs; invalid item: ${JSON.stringify(glob)}`,
  );
}
