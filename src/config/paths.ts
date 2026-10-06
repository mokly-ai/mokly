import fs from "node:fs";
import path from "node:path";

import { MoklyError } from "../errors.js";

const dotSegment = /(?:^|\/)\.\.?(?:\/|$)/u;

/** Normalize an absolute path without re-normalizing canonical POSIX input. */
export function resolveAbsolutePath(candidate: string): string {
  return path.sep === "/" && normalizedAbsolutePosix(candidate)
    ? candidate
    : path.resolve(candidate);
}

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

/** Return whether a candidate path is contained by a configured root. */
export function isInside(root: string, candidate: string): boolean {
  if (
    path.sep === "/" &&
    normalizedAbsolutePosix(root) &&
    normalizedAbsolutePosix(candidate)
  )
    return (
      root === candidate ||
      (candidate.startsWith(root) && candidate[root.length] === "/")
    );
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      !relative.startsWith(`..${path.sep}`) &&
      relative !== "..")
  );
}

/** Only normalized absolute POSIX paths have equivalent segment-prefix semantics. */
function normalizedAbsolutePosix(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.endsWith("/") &&
    !value.includes("//") &&
    !dotSegment.test(value)
  );
}

/** Resolve existing symlinks while projecting a path that may not exist yet. */
export function projectRealPath(candidate: string): string {
  for (let attempt = 0; ; attempt++) {
    const missingParts: string[] = [];
    let existing = candidate;
    let stats = existingStats(existing);
    while (!stats) {
      const parent = path.dirname(existing);
      if (parent === existing) return candidate;
      missingParts.unshift(path.basename(existing));
      existing = parent;
      stats = existingStats(existing);
    }
    try {
      return path.resolve(fs.realpathSync.native(existing), ...missingParts);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "ENOENT" ||
        stats.isSymbolicLink() ||
        attempt >= 4
      )
        throw error;
    }
  }
}

function existingStats(candidate: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}
