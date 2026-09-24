import fs from "node:fs";
import path from "node:path";

import { isSafeCatalogueRoute } from "@mokly/viewer/data";

import { isInside, projectRealPath } from "../config/paths.js";
import { isInternalCatalogueFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import { gitBlobHash } from "../registry/blob_hash.js";
import { MANIFEST_NAME, serializeManifest } from "../registry/manifest.js";

import type { Compilation } from "./compile.js";
import { isReservedSource } from "./source_inventory.js";

/** Refuse a staged tree whose exact bytes differ from its v6 manifest inventory. */
export function validateGeneratedInventory(compilation: Compilation): void {
  const { manifest, outputs } = compilation;
  const routes = [...outputs.keys()]
    .filter((route) => route !== MANIFEST_NAME)
    .sort((left, right) => left.localeCompare(right));
  const recorded = manifest.generatedFiles;
  if (
    routes.length !== recorded.length ||
    routes.some((route, index) => route !== recorded[index]?.path)
  )
    throw new MoklyError(
      "build-invalid",
      "generated inventory does not match output paths",
    );
  for (const { path: route, blobHash } of recorded) {
    const content = outputs.get(route)!;
    if (
      gitBlobHash(Buffer.from(content, "utf8"), manifest.blobHashAlgorithm) !==
      blobHash
    )
      throw new MoklyError(
        "build-invalid",
        `generated inventory has stale bytes: ${route}`,
      );
  }
  if (outputs.get(MANIFEST_NAME) !== serializeManifest(manifest))
    throw new MoklyError(
      "build-invalid",
      "generated inventory manifest bytes do not match",
    );
}

/** Reject unsafe generated routes with the rule that protects their target. */
export function validateGeneratedOutputPaths(
  routes: Iterable<string>,
  config: ResolvedConfig,
): void {
  const realRepoRoot = fs.realpathSync(config.repoRoot);
  const realMockupsRoot = projectRealPath(config.generatedDir);
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
    if (isReservedSource(route))
      throw new MoklyError(
        "build-invalid",
        `generated route has a reserved source basename: ${route}`,
      );
    const target = path.resolve(config.generatedDir, route);
    if (route !== MANIFEST_NAME && isInternalCatalogueFile(target, config))
      throw new MoklyError(
        "build-invalid",
        `generated route targets internal catalogue metadata: ${route}`,
      );
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
    if (!isInside(config.generatedDir, target)) {
      throw new MoklyError(
        "build-invalid",
        `generated route escapes mockupsDir: ${route}`,
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
