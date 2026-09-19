import fs from "node:fs";
import path from "node:path";

import { MoklyError, type MoklyErrorCode } from "../errors.js";

import { MOKLY_CACHE } from "./cache_paths.js";
import { isInside, projectRealPath, resolveInside } from "./paths.js";
import { requireString } from "./rules.js";

interface ReviewOutBoundary {
  /** Directories holding resolved entry modules, or the entriesDir shorthand. */
  entryRoots?: readonly string[];
  /** Resolved entry modules when discovery has already run. */
  entryModules?: readonly string[];
  /** Shorthand directory before discovery has resolved any module. */
  entriesDir?: string;
  mockupsDir: string;
  repoRoot: string;
}

/** Directories that hold authored entry modules for a boundary check. */
export function entryRootsOf(boundary: ReviewOutBoundary): string[] {
  if (boundary.entriesDir) return [boundary.entriesDir];
  return [
    ...new Set([
      ...(boundary.entryRoots ?? []),
      ...(boundary.entryModules ?? []).map((module) => path.dirname(module)),
    ]),
  ];
}

/** Resolve an optional consumer module and require a regular file. */
export function optionalModule(
  repoRoot: string,
  configDir: string,
  value: string | undefined,
  label: string,
): string | undefined {
  if (value === undefined) return undefined;
  requireString(value, label);
  const resolved = resolveInside(repoRoot, configDir, value, label);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new MoklyError(
      "config-invalid",
      `${label} does not name a file: ${value}`,
    );
  }
  requireRealInside(repoRoot, resolved, label);
  return resolved;
}

/** Require a configured directory to exist. */
export function requireDirectory(value: string, label: string): void {
  if (!fs.existsSync(value) || !fs.statSync(value).isDirectory()) {
    throw new MoklyError(
      "config-invalid",
      `${label} does not name a directory: ${value}`,
    );
  }
}

/** Reject a shorthand source root whose ownership cannot be distinguished from output. */
export function validateSourceRoots(
  repoRoot: string,
  entriesDir: string | undefined,
  mockupsDir: string,
): void {
  const realMockups = requireRealInside(repoRoot, mockupsDir, "mockupsDir");
  if (entriesDir === undefined) return;
  const realEntries = requireRealInside(repoRoot, entriesDir, "entriesDir");
  if (entriesDir === mockupsDir || realEntries === realMockups)
    throw new MoklyError(
      "config-invalid",
      "authored source directories must not equal mockupsDir",
    );
}

/** Keep destructive Review replacement away from source and output roots. */
export function validateReviewOut(
  reviewOut: string,
  boundary: ReviewOutBoundary,
  label = "review.outDir",
  code: MoklyErrorCode = "config-invalid",
): void {
  const { mockupsDir, repoRoot } = boundary;
  const protectedRoots = [
    mockupsDir,
    ...entryRootsOf(boundary),
    path.join(repoRoot, MOKLY_CACHE),
  ];
  const realRepoRoot = fs.realpathSync(repoRoot);
  const realReviewOut = configuredRealPath(reviewOut, label, code);
  const realProtectedRoots = protectedRoots.map((root) =>
    configuredRealPath(root, label, code),
  );
  if (
    reviewOut === repoRoot ||
    (!isInside(repoRoot, reviewOut) && !isInside(realRepoRoot, reviewOut)) ||
    !isInside(realRepoRoot, realReviewOut) ||
    protectedRoots.some(
      (root) =>
        reviewOut === root ||
        isInside(reviewOut, root) ||
        isInside(root, reviewOut),
    ) ||
    realProtectedRoots.some(
      (root) =>
        realReviewOut === root ||
        isInside(realReviewOut, root) ||
        isInside(root, realReviewOut),
    )
  ) {
    if (!isInside(realRepoRoot, realReviewOut)) {
      throw new MoklyError(
        code,
        `${label} resolves outside repoRoot through a symlink`,
      );
    }
    throw new MoklyError(
      code,
      `${label} must not overlap repository, mockup, source, or cache roots`,
    );
  }
}

function requireRealInside(
  repoRoot: string,
  candidate: string,
  label: string,
): string {
  const realRepoRoot = fs.realpathSync(repoRoot);
  const realCandidate = configuredRealPath(candidate, label);
  if (!isInside(realRepoRoot, realCandidate)) {
    throw new MoklyError(
      "config-invalid",
      `${label} resolves outside repoRoot through a symlink`,
    );
  }
  return realCandidate;
}

function configuredRealPath(
  candidate: string,
  label: string,
  code: MoklyErrorCode = "config-invalid",
): string {
  try {
    return projectRealPath(candidate);
  } catch (cause) {
    throw new MoklyError(
      code,
      `${label} has an invalid filesystem path: ${candidate}`,
      { cause },
    );
  }
}
