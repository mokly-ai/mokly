import fs from "node:fs";
import path from "node:path";

import { isSafeCatalogueRoute } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

/** Convert a platform path to stable POSIX separators. */
export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

/** Resolve a configured path and require it to stay inside the repository. */
export function resolveInside(
  repoRoot: string,
  fromDir: string,
  value: string,
  label: string,
): string {
  if (value.trim().length === 0) {
    throw new MoklyError("config-invalid", `${label} must not be empty`);
  }
  const resolved = path.resolve(fromDir, value);
  const relative = path.relative(repoRoot, resolved);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new MoklyError(
      "config-invalid",
      `${label} resolves outside repoRoot: ${toPosixPath(relative)}`,
    );
  }
  return resolved;
}

/** Require a route-like value to be safe, relative, and POSIX-normalized. */
export function validateRelativeRoute(value: string, label: string): string {
  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.split("/").includes("..") ||
    normalized.includes("\0")
  ) {
    throw new MoklyError(
      "config-invalid",
      `${label} must be a safe relative path`,
    );
  }
  return normalized.replace(/^\.\//, "");
}

/** Normalize and require a portable static catalogue `.html` route. */
export function validateCatalogueRoute(value: string, label: string): string {
  const normalized = validateRelativeRoute(value, label);
  if (!isSafeCatalogueRoute(normalized)) {
    throw new MoklyError(
      "config-invalid",
      `${label} must use portable URL-safe path segments and end in .html`,
    );
  }
  return normalized;
}

/** Return whether a candidate path is contained by a configured root. */
export function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      !relative.startsWith(`..${path.sep}`) &&
      relative !== "..")
  );
}

/** Resolve existing symlinks while projecting a path that may not exist yet. */
export function projectRealPath(candidate: string): string {
  const missingParts: string[] = [];
  let existing = candidate;
  while (!lexicallyExists(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return candidate;
    missingParts.unshift(path.basename(existing));
    existing = parent;
  }
  return path.resolve(fs.realpathSync.native(existing), ...missingParts);
}

function lexicallyExists(candidate: string): boolean {
  try {
    fs.lstatSync(candidate);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
