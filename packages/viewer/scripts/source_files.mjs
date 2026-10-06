import path from "node:path";

const ignoredDirectories = new Set([
  ".context",
  ".mokly-cache",
  ".wrangler",
  ".turbo",
  ".superpowers",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "test-results",
  "playwright-report",
]);

/** Copy only authored assets, using paths relative to the asset directory. */
export function isSourceAsset(relative) {
  return !relative
    .split(path.sep)
    .some(
      (part) =>
        ignoredDirectories.has(part) ||
        part.startsWith(".mokly-write-") ||
        part.startsWith(".mokly-review-") ||
        part.endsWith(".tgz"),
    );
}
