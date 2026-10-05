import fs from "node:fs";
import path from "node:path";

import { isSafeCatalogueRoute } from "@mokly/viewer/data";

import { isInside, projectRealPath } from "../config/paths.js";
import { isInternalCatalogueFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

import { assertSafeGeneratedTree } from "./reserved_tree.js";
import { sourceDenialMessage } from "./source_denial.js";
import {
  isAuthoringSource,
  matchingPublicExclusion,
} from "./source_inventory.js";
import { isGeneratedRoute, isValidGeneratedRoute } from "./styles/routes.js";

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
  assertSafeGeneratedTree(config);
  for (const route of [...routes].sort()) {
    const reserved = isGeneratedRoute(route);
    if (reserved && !isValidGeneratedRoute(route))
      throw new MoklyError(
        "build-invalid",
        `generated route is unsafe: ${route}; use mokly-generated/styles/<root path>.css or mokly-generated/assets/<asset path> with supported extensions`,
      );
    if (!reserved && route !== MANIFEST_NAME && !isSafeCatalogueRoute(route)) {
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
    if (reserved) {
      const glob = matchingPublicExclusion(
        target,
        config.mockupsDir,
        config.publicExclude,
      );
      if (glob !== undefined)
        throw new MoklyError(
          "build-invalid",
          `generated route matches public exclusion ${glob}: ${route}; narrow the exclusion so Mokly-generated files stay public`,
        );
    }
    const denial = reserved
      ? undefined
      : isAuthoringSource(target, config, "all", {
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
