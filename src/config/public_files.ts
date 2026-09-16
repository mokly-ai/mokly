import fs from "node:fs";
import path from "node:path";

import { sourceDenialMessage } from "../build/source_denial.js";
import { isAuthoringSource } from "../build/source_inventory.js";
import { errorMessage } from "../errors.js";
import {
  FORMER_MANIFEST_NAME,
  LEGACY_MANIFEST_NAME,
  MANIFEST_NAME,
} from "../registry/manifest.js";

import { isBaselineCachePath } from "./cache_paths.js";
import { locatePath, type FileLocation } from "./file_locations.js";
import { projectRealPath } from "./paths.js";
import type { ResolvedConfig } from "./types.js";

/** Catalogue manifests are internal even when requested through another path. */
export function isInternalCatalogueFile(
  candidate: string,
  config: ResolvedConfig,
  resolveAliases = true,
): boolean {
  const internal = [
    MANIFEST_NAME,
    FORMER_MANIFEST_NAME,
    LEGACY_MANIFEST_NAME,
  ].map((name) => path.join(config.mockupsDir, name));
  if (internal.includes(candidate)) return true;
  if (!resolveAliases) return false;
  const realCandidate = projectRealPath(candidate);
  return internal.some(
    (file) => fs.existsSync(file) && realCandidate === fs.realpathSync(file),
  );
}

/** Shared denial policy; historical readers disable current filesystem aliases. */
export function isPrivateStaticPath(
  candidate: string,
  config: ResolvedConfig,
  resolveAliases = true,
): boolean {
  return (
    privateStaticPathReason(candidate, config, resolveAliases) !== undefined
  );
}

/** Preserve the protection cause for validation while HTTP readers return not found. */
export function privateStaticPathReason(
  candidate: string,
  config: ResolvedConfig,
  resolveAliases = true,
): string | undefined {
  if (isBaselineCachePath(candidate, config.repoRoot, resolveAliases))
    return "targets the private .mokly-cache directory";
  if (isInternalCatalogueFile(candidate, config, resolveAliases))
    return "targets internal catalogue metadata";
  const denial = isAuthoringSource(
    candidate,
    config,
    resolveAliases ? "all" : "none",
  );
  return denial && sourceDenialMessage(denial);
}

/** Explain a failed public-file check without replacing its caller's typed error. */
export function publicFileFailureReason(
  candidate: string,
  config: ResolvedConfig,
): string | undefined {
  try {
    return privateStaticPathReason(candidate, config);
  } catch (error) {
    return `could not resolve public path: ${errorMessage(error)}`;
  }
}

/** Locate a public path, retaining confined missing paths for deletion handling. */
export function publicPathLocation(
  candidate: string,
  config: ResolvedConfig,
): FileLocation | undefined {
  try {
    const location = locatePath(candidate, config.mockupsDir, config.repoRoot);
    if (!location || isPrivateStaticPath(location.logicalPath, config)) return;
    return location;
  } catch {
    return;
  }
}

/** Locate a public regular file for readers that must use its validated target. */
export function publicFileLocation(
  candidate: string,
  config: ResolvedConfig,
): FileLocation | undefined {
  const location = publicPathLocation(candidate, config);
  try {
    if (location && fs.statSync(location.physicalPath).isFile())
      return location;
  } catch {
    return;
  }
}

/** Return whether a path names a public regular file beneath the output root. */
export function isPublicStaticFile(
  candidate: string,
  config: ResolvedConfig,
): boolean {
  return publicFileLocation(candidate, config) !== undefined;
}
