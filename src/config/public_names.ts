import { isSafeRepositoryPath } from "@mokly/viewer/data";

const privateDirectories = new Set([
  "node_modules",
  "target",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
]);

/** Shared lexical names for copied document resources and public export files. */
export function publicFileNameDenial(name: string): string | undefined {
  if (!isSafeRepositoryPath(name))
    return "is not a safe repository-relative path";
  for (const part of name.split("/")) {
    if (part.startsWith(".")) return "contains a hidden path segment";
    if (privateDirectories.has(part))
      return `is inside a private build or dependency directory (${part})`;
  }
  if (/\.(?:[cm]?[jt]sx?|map)$/i.test(name))
    return "uses a private module or source-map extension";
}
