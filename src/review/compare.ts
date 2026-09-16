import path from "node:path";

import { minimatch } from "minimatch";

import type {
  ManifestScreen,
  Manifest,
  ReviewArtifact,
  ReviewArtifactContent,
  ReviewResult,
  ScreenReview,
} from "@mokly/viewer/data";

import type { Compilation } from "../build/compile.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { hasRegisteredComponents } from "../registry/manifest_capabilities.js";

import {
  copySnapshotDependencies,
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
  type ReviewAssetReader,
} from "./assets.js";
import { baselineResourceConfig, readBaseManifest } from "./base_manifest.js";
import { reviewChangedPaths } from "./changed_paths.js";
import { CompilationAssetReader } from "./compilation_assets.js";
import { compareComponentCatalogue } from "./component_compare.js";
import { ComponentMaterialReader } from "./component_resources.js";
import type { ReadOnlyReviewRepository } from "./repository.js";
import { ResourceComparison } from "./resource_comparison.js";
import { compareScreen } from "./screen_compare.js";
import { aggregateIgnored, fragmentRoutes } from "./screen_views.js";

/** Compare checked head output to its Git branch point and retain pane artifacts. */
export async function compareReview(
  compilation: Compilation,
  config: ResolvedConfig,
  git: ReadOnlyReviewRepository,
  baseRef: string,
  outDir = config.review.outDir,
  assetReader: ReviewAssetReader = new FileSystemReviewAssetReader(config),
  changedPathExclusions: readonly string[] = [],
): Promise<ReviewArtifact> {
  const baseCommit = await git.evidence.mergeBase(baseRef, "HEAD");
  const baseManifest = await readBaseManifest(git.reader, baseCommit, config);
  const changedPaths = await reviewChangedPaths(
    git.evidence,
    baseCommit,
    config,
    outDir,
    changedPathExclusions,
  );
  const mockupsPrefix = toPosixPath(
    path.relative(config.repoRoot, config.mockupsDir),
  );
  const baseAssetReader = new GitReviewAssetReader(
    baselineResourceConfig(config, baseManifest),
    git.reader,
    baseCommit,
    mockupsPrefix,
  );
  if (
    hasRegisteredComponents(baseManifest) ||
    hasRegisteredComponents(compilation.manifest)
  )
    return compareComponentCatalogue(
      compilation,
      baseManifest,
      config,
      baseAssetReader,
      assetReader,
      changedPaths,
      baseCommit,
      baseRef,
    );
  const files = new Map<string, ReviewArtifactContent>();
  const baseSeeds = new Set<string>();
  const headSeeds = new Set<string>();
  const baseByRoute = screenMap(baseManifest);
  const headByRoute = screenMap(compilation.manifest);
  const baseDocuments = await timeAsync("review.base-documents", () =>
    baseAssetReader.readMany(
      [...baseByRoute.values()].flatMap((screen) => fragmentRoutes(screen)),
    ),
  );
  const routes = [
    ...new Set([...baseByRoute.keys(), ...headByRoute.keys()]),
  ].sort();
  const sharedImpact = changedPaths.filter((changed) =>
    config.review.sharedImpact.some((glob) =>
      minimatch(changed, glob, { dot: true }),
    ),
  );
  const screens: ScreenReview[] = [];
  const resources = new ResourceComparison(
    new ComponentMaterialReader(baseAssetReader),
    new ComponentMaterialReader(
      new CompilationAssetReader(compilation.outputs, assetReader),
    ),
    new Set(changedPaths),
    mockupsPrefix,
  );
  await timeAsync("review.compare-screens", async () => {
    for (const route of routes) {
      const base = baseByRoute.get(route);
      const head = headByRoute.get(route);
      screens.push(
        await compareScreen(
          base,
          head,
          baseDocuments,
          compilation,
          changedPaths,
          sharedImpact,
          files,
          baseSeeds,
          headSeeds,
          resources,
          config,
        ),
      );
    }
  });
  await copySnapshotDependencies(
    files,
    "before",
    baseSeeds,
    (route) => baseAssetReader.read(route),
    (routes) => baseAssetReader.readMany(routes),
  );
  await copySnapshotDependencies(files, "after", headSeeds, async (route) => {
    const generated = compilation.outputs.get(route);
    return generated ?? assetReader.read(route);
  });
  const result: ReviewResult = {
    baseCommit,
    baseRef,
    changedPaths,
    ignoredImpact: aggregateIgnored(screens),
    schemaVersion: 2,
    screens,
    sharedImpact,
  };
  return { files, result };
}

function screenMap(manifest: Manifest): Map<string, ManifestScreen> {
  return new Map(
    manifest.entries
      .filter((entry): entry is ManifestScreen => entry.kind === "screen")
      .map((entry) => [entry.route, entry]),
  );
}
