import path from "node:path";

import { Minimatch } from "minimatch";

import { isEntryPath, isPathSegment } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import { isBaselineCachePath } from "./cache_paths.js";
import { requireDirectory } from "./path_validation.js";
import { projectRealPath, resolveInside } from "./paths.js";
import { validateRelativeGlobs } from "./relative_globs.js";
import { validateRootReservedPath } from "./reserved_paths.js";
import { requireString } from "./rules.js";
import type { ResolvedRoot } from "./types.js";

const DEFAULT_FILES = ["**/*.mockup.{ts,tsx}", "**/*.md"];

/** Resolve roots without preserving former discovery configuration. */
export function resolveRoots(
  value: unknown,
  repoRoot: string,
  configDir: string,
  mockupsDir: string,
): readonly ResolvedRoot[] {
  const input: unknown = value === undefined ? [{ dir: "specs" }] : value;
  if (!Array.isArray(input) || !input.length)
    throw invalid("roots", "must be a nonempty array");
  const seen = new Set<string>();
  return input.map((item: unknown, index: number) => {
    const at = `roots[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw invalid(at, "must be an object");
    const root = item as Record<string, unknown>;
    for (const key of Object.keys(root))
      if (!["dir", "files", "path", "transparent"].includes(key))
        throw invalid(`${at}.${key}`, "is an unknown field");
    requireString(root.dir, `${at}.dir`);
    const dir = resolveInside(repoRoot, configDir, root.dir, `${at}.dir`);
    validateRootReservedPath(dir, root.dir, index, mockupsDir);
    requireDirectory(dir, `${at}.dir`);
    if (isBaselineCachePath(dir, repoRoot))
      throw invalid(`${at}.dir`, "must not be inside .mokly-cache");
    const realDir = projectRealPath(dir);
    if (seen.has(realDir))
      throw invalid(`${at}.dir`, `duplicates ${path.relative(repoRoot, dir)}`);
    seen.add(realDir);
    const files = validateRelativeGlobs(
      root.files === undefined ? DEFAULT_FILES : root.files,
      `${at}.files`,
    );
    validateRootReservedPath(dir, root.dir, index, mockupsDir, files);
    try {
      for (const glob of files) new Minimatch(glob, { dot: true });
    } catch {
      throw invalid(`${at}.files`, "contains an invalid glob");
    }
    if (!files.length || new Set(files).size !== files.length)
      throw invalid(
        `${at}.files`,
        "must be nonempty and contain no duplicates",
      );
    if (root.path !== undefined && !isEntryPath(root.path))
      throw invalid(`${at}.path`, "must be a valid path");
    const transparent: unknown =
      root.transparent === undefined ? [] : root.transparent;
    if (
      !Array.isArray(transparent) ||
      !transparent.every(isPathSegment) ||
      new Set(transparent).size !== transparent.length
    )
      throw invalid(
        `${at}.transparent`,
        "must be an array of unique path segments",
      );
    return {
      dir,
      files,
      ...(root.path === undefined ? {} : { path: root.path as string }),
      transparent: [...transparent] as string[],
    };
  });
}

function invalid(field: string, reason: string): MoklyError {
  return new MoklyError("config-invalid", `${field} ${reason}`);
}
