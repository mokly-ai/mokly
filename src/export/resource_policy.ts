import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { sourceDenialMessage } from "../build/source_denial.js";
import { isAuthoringSource } from "../build/source_inventory.js";
import {
  isGeneratedRoute,
  isPublicGeneratedRoute,
} from "../build/styles/routes.js";
import { entryModuleRoots } from "../config/entry_membership.js";
import { isInside, projectRealPath } from "../config/paths.js";
import { publicFileNameDenial } from "../config/public_names.js";
import type { ResolvedConfig } from "../config/types.js";
import { EARLIER_MANIFEST_NAMES, MANIFEST_NAME } from "../registry/manifest.js";

import { exportError } from "./error.js";

function exportPublicNameDenial(
  name: string,
  config: ResolvedConfig,
  options: { resolveAliases?: boolean; generated?: ReadonlySet<string> },
): string | undefined {
  if (!isSafeRepositoryPath(name))
    return "is not a safe repository-relative path";
  const denial = isAuthoringSource(
    path.resolve(config.mockupsDir, name),
    config,
    options.resolveAliases === false ? "none" : "all",
  );
  if (denial) return sourceDenialMessage(denial);
  if ([MANIFEST_NAME, ...EARLIER_MANIFEST_NAMES].includes(name as never))
    return "targets internal catalogue metadata";
  if (isGeneratedRoute(name))
    return isPublicGeneratedRoute(name, options.generated)
      ? undefined
      : "targets private or uncaptured generated output";
  if (options.generated?.has(name)) return;
  return publicFileNameDenial(name);
}

/** Snapshot names use lexical policy; current capture additionally resolves aliases. */
export function exportResourcePolicy(
  config: ResolvedConfig,
  resolveAliases = true,
  generated?: ReadonlySet<string>,
): (name: string) => boolean {
  const denial = exportResourceDenial(config, resolveAliases, generated);
  return (name) => denial(name) === undefined;
}

/** Retain the public-policy cause when a required snapshot resource is rejected. */
export function exportResourceDenial(
  config: ResolvedConfig,
  resolveAliases = true,
  generated?: ReadonlySet<string>,
): (name: string) => string | undefined {
  const mockups = projectRealPath(config.mockupsDir);
  const packages = config.moduleResolution.packageRoots.map(projectRealPath);
  if (packages.includes(mockups))
    throw exportError(
      "A consumer package root must not equal mockupsDir; choose a separate public output directory.",
    );
  const roots = [
    ...entryModuleRoots(config).map((root) => ({
      path: root,
      reason: sourceDenialMessage({ kind: "entries" }),
    })),
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
    const denial = exportPublicNameDenial(name, config, {
      resolveAliases,
      ...(generated ? { generated } : {}),
    });
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
