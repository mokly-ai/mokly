import fs from "node:fs";
import path from "node:path";

import {
  GENERATED_DIRECTORY,
  isSafeCatalogueRoute,
  isSafeRepositoryPath,
} from "@mokly/viewer/data";

import { isInside, projectRealPath } from "../config/paths.js";
import { isInternalCatalogueFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { isDocumentResource } from "../documents/resource_paths.js";
import { MoklyError, errorMessage } from "../errors.js";
import { gitBlobHash } from "../registry/blob_hash.js";
import { MANIFEST_NAME, serializeManifest } from "../registry/manifest.js";

import type { Compilation } from "./compile.js";
import { generatedBytes } from "./generated_file.js";
import { validateOutputCollisions } from "./output_collisions.js";
import { isReservedSource } from "./source_inventory.js";
import { isValidGeneratedRoute } from "./styles/routes.js";

/** Refuse a staged tree whose exact bytes differ from its v8 manifest inventory. */
export function validateGeneratedInventory(compilation: Compilation): void {
  const { manifest, outputs } = compilation;
  const routes = [...outputs.keys()]
    .filter((route) => route !== MANIFEST_NAME)
    .sort();
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
      gitBlobHash(generatedBytes(content), manifest.blobHashAlgorithm) !==
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
  const outputRoutes = [...routes];
  validateOutputCollisions(outputRoutes);
  const realMockupsRoot = validateGeneratedRoot(config);
  for (const route of outputRoutes) {
    if (
      route !== MANIFEST_NAME &&
      !isSafeCatalogueRoute(route) &&
      !isValidGeneratedRoute(route) &&
      !(isSafeRepositoryPath(route) && isDocumentResource(route))
    ) {
      throw new MoklyError(
        "build-invalid",
        `generated route is unsafe: ${route}`,
      );
    }
    const first = route.split("/")[0]!;
    if (
      /\.html?$/i.test(route) &&
      ["styles", "assets"].includes(first.toLowerCase())
    )
      throw new MoklyError(
        "build-invalid",
        `generated HTML route uses reserved first segment ${first}: ${route}; styles and assets are reserved for generated stylesheets and assets`,
      );
    if (isReservedSource(route))
      throw new MoklyError(
        "build-invalid",
        `generated route has a reserved source basename: ${route}`,
      );
    const target = path.resolve(config.generatedDir, route);
    if (
      route !== MANIFEST_NAME &&
      isInternalCatalogueFile(target, config, false)
    )
      throw new MoklyError(
        "build-invalid",
        `generated route targets internal catalogue metadata: ${route}`,
      );
    let projectedTarget: string;
    try {
      projectedTarget = path.resolve(realMockupsRoot, route);
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

/** Confine catalogue ancestors before any disposable-tree inspection or write. */
export function validateGeneratedRoot(config: ResolvedConfig): string {
  const realRepoRoot = fs.realpathSync(config.repoRoot);
  const realMockupsRoot = path.join(
    projectRealPath(config.mockupsDir),
    GENERATED_DIRECTORY,
  );
  if (!isInside(realRepoRoot, realMockupsRoot)) {
    throw new MoklyError(
      "build-invalid",
      "mockupsDir resolves outside repoRoot through a symlink",
    );
  }
  return realMockupsRoot;
}
