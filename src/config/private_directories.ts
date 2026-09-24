import { MOKLY_CACHE } from "./cache_paths.js";
import { GENERATED_DIRECTORY } from "./paths.js";

/** Directory names excluded from consumer source discovery and broad watches. */
export const DENIED_SOURCE_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ".context",
  ".git",
  GENERATED_DIRECTORY,
  MOKLY_CACHE,
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "target",
  "test-results",
]);

/** Temporary-directory prefixes excluded from source discovery and broad watches. */
export const DENIED_SOURCE_TEMPORARY_PREFIXES = [
  ".mokly-review-",
  ".mokly-write-",
] as const;

/** Return whether one relative path segment belongs to a denied source tree. */
export function isDeniedSourceSegment(segment: string): boolean {
  return (
    DENIED_SOURCE_DIRECTORY_NAMES.has(segment) ||
    DENIED_SOURCE_TEMPORARY_PREFIXES.some((prefix) =>
      segment.startsWith(prefix),
    )
  );
}
