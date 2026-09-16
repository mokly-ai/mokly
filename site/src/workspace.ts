/**
 * Where the build reads the repository's own files from. Astro bundles the
 * modules that run during a build, so `import.meta.url` no longer points at
 * the source tree by the time they execute; the site package is located from
 * the directory the build runs in instead, and the location is checked so a
 * wrong working directory fails with a message rather than a missing file.
 */

import { existsSync } from "node:fs";
import path from "node:path";

function locate(): string {
  const start = process.cwd();
  for (const candidate of [start, path.join(start, "site")]) {
    if (existsSync(path.join(candidate, "astro.config.mjs"))) return candidate;
  }
  throw new Error(
    `The site build must run from the site package or the repository root; ${start} is neither.`,
  );
}

/** The site package directory. */
export const SITE_ROOT = locate();

/** The repository the site is built from. */
export const REPOSITORY_ROOT = path.resolve(SITE_ROOT, "..");

/** Resolve a path inside the site package. */
export function sitePath(...segments: readonly string[]): string {
  return path.join(SITE_ROOT, ...segments);
}

/** Resolve a path inside the repository the site is built from. */
export function repositoryPath(...segments: readonly string[]): string {
  return path.join(REPOSITORY_ROOT, ...segments);
}
