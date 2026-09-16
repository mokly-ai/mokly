import fs from "node:fs";
import path from "node:path";

import {
  isInside,
  isSafeCatalogueRoute,
  projectRealPath,
} from "../config/paths.js";
import { isInternalCatalogueFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

import { sourceDenialMessage } from "./source_denial.js";
import { isAuthoringSource } from "./source_inventory.js";

/** Reject unsafe generated routes with the rule that protects their target. */
export function validateGeneratedOutputPaths(
  routes: Iterable<string>,
  config: ResolvedConfig,
): void {
  const realRepoRoot = fs.realpathSync(config.repoRoot);
  const realMockupsRoot = projectRealPath(config.mockupsDir);
  if (!isInside(realRepoRoot, realMockupsRoot)) {
    throw new MoklyError(
      "build-invalid",
      "mockupsDir resolves outside repoRoot through a symlink",
    );
  }
  for (const route of routes) {
    if (route !== MANIFEST_NAME && !isSafeCatalogueRoute(route)) {
      throw new MoklyError(
        "build-invalid",
        `generated route is unsafe: ${route}`,
      );
    }
    const target = path.resolve(config.mockupsDir, route);
    let projectedTarget: string;
    try {
      projectedTarget = projectRealPath(target);
    } catch (error) {
      throw new MoklyError(
        "build-invalid",
        `could not validate generated route ${route}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
    if (!isInside(config.mockupsDir, target)) {
      throw new MoklyError(
        "build-invalid",
        `generated route escapes mockupsDir: ${route}`,
      );
    }
    if (route !== MANIFEST_NAME && isInternalCatalogueFile(target, config)) {
      throw new MoklyError(
        "build-invalid",
        `generated route targets internal catalogue metadata: ${route}`,
      );
    }
    const denial = isAuthoringSource(target, config, "all", {
      ignorePublicExclusions: route === MANIFEST_NAME,
    });
    if (denial) {
      throw new MoklyError(
        "build-invalid",
        `generated route ${sourceDenialMessage(denial)}: ${route}`,
      );
    }
    if (!isInside(realMockupsRoot, projectedTarget)) {
      throw new MoklyError(
        "build-invalid",
        `generated route escapes mockupsDir: ${route}`,
      );
    }
  }
}
