import path from "node:path";

import { sourceDenialMessage } from "../build/source_denial.js";
import { isAuthoringSource } from "../build/source_inventory.js";
import {
  isInside,
  isSafeRepositoryPath,
  projectRealPath,
} from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import {
  FORMER_MANIFEST_NAME,
  LEGACY_MANIFEST_NAME,
  MANIFEST_NAME,
} from "../registry/manifest.js";

import { exportError } from "./error.js";

const PRIVATE_DIRECTORIES = new Set([
  "node_modules",
  "target",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
]);

/** Public names cannot identify private modules, hidden paths, or cache trees. */
export function isExportPublicName(
  name: string,
  config: ResolvedConfig,
  options: { allowBuildDirectories?: boolean; resolveAliases?: boolean } = {},
): boolean {
  return exportPublicNameDenial(name, config, options) === undefined;
}

function exportPublicNameDenial(
  name: string,
  config: ResolvedConfig,
  options: { allowBuildDirectories?: boolean; resolveAliases?: boolean },
): string | undefined {
  if (!isSafeRepositoryPath(name))
    return "is not a safe repository-relative path";
  const denial = isAuthoringSource(
    path.resolve(config.mockupsDir, name),
    config,
    options.resolveAliases === false ? "none" : "all",
  );
  if (denial) return sourceDenialMessage(denial);
  if (
    [MANIFEST_NAME, FORMER_MANIFEST_NAME, LEGACY_MANIFEST_NAME].includes(name)
  )
    return "targets internal catalogue metadata";
  for (const part of name.split("/")) {
    if (part.startsWith(".")) return "contains a hidden path segment";
    if (!options.allowBuildDirectories && PRIVATE_DIRECTORIES.has(part))
      return `is inside a private build or dependency directory (${part})`;
  }
  if (/\.(?:[cm]?[jt]sx?|map)$/i.test(name))
    return "uses a private module or source-map extension";
}

/** Snapshot names use lexical policy; current capture additionally resolves aliases. */
export function exportResourcePolicy(
  config: ResolvedConfig,
  resolveAliases = true,
): (name: string) => boolean {
  const denial = exportResourceDenial(config, resolveAliases);
  return (name) => denial(name) === undefined;
}

/** Retain the public-policy cause when a required snapshot resource is rejected. */
export function exportResourceDenial(
  config: ResolvedConfig,
  resolveAliases = true,
): (name: string) => string | undefined {
  const mockups = projectRealPath(config.mockupsDir);
  const packages = config.moduleResolution.packageRoots.map(projectRealPath);
  if (packages.includes(mockups))
    throw exportError(
      "A consumer package root must not equal mockupsDir; choose a separate public output directory.",
    );
  const roots = [
    {
      path: config.entriesDir,
      reason: sourceDenialMessage({ kind: "entries" }),
    },
    {
      path: config.review.outDir,
      reason: "is inside the Review output directory",
    },
    ...packages
      .filter((root) => isInside(mockups, root))
      .map((root) => ({
        path: root,
        reason: "is inside a consumer package root",
      })),
  ].flatMap((root) => [root, { ...root, path: projectRealPath(root.path) }]);
  const files = [
    {
      path: config.configPath,
      reason: "is the catalogue configuration module",
    },
    { path: config.renderer, reason: "is the configured renderer module" },
    {
      path: config.compatibility.transformer,
      reason: "is the configured compatibility transformer",
    },
    ...(config.sourceFiles ?? []).map((name) => ({
      path: path.resolve(config.repoRoot, name),
      reason: sourceDenialMessage({ kind: "listed" }),
    })),
  ].flatMap(({ path: file, reason }) =>
    file
      ? [
          { path: file, reason },
          { path: projectRealPath(file), reason },
        ]
      : [],
  );
  return (name) => {
    const denial = exportPublicNameDenial(name, config, { resolveAliases });
    if (denial) return denial;
    const candidates = [
      path.resolve(config.mockupsDir, name),
      path.resolve(mockups, name),
    ];
    for (const candidate of candidates) {
      const protectedPath =
        files.find((file) => file.path === candidate) ??
        roots.find((root) => isInside(root.path, candidate));
      if (protectedPath) return protectedPath.reason;
    }
  };
}
