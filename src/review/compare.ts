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
import { generatedManifestRoutes } from "../registry/generated_routes.js";
import { hasRegisteredComponents } from "../registry/manifest_capabilities.js";

import type { ArtifactLayouts } from "./artifact_resources.js";
import {
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
import { copySnapshotDependencies } from "./snapshot_dependencies.js";

export interface CompareReviewOptions {
  /** Disable the unchanged-view optimization for differential tests. */
  useFastPath?: boolean;
}

/** Compare checked head output to its Git branch point and retain pane artifacts. */
export async function compareReview(
  compilation: Compilation,
  config: ResolvedConfig,
  git: ReadOnlyReviewRepository,
  baseRef: string,
  outDir = config.review.outDir,
  assetReader: ReviewAssetReader = new CompilationAssetReader(
    compilation.outputs,
    new FileSystemReviewAssetReader(config),
  ),
  changedPathExclusions: readonly string[] = [],
  options: CompareReviewOptions = {},
): Promise<ReviewArtifact & { generatedLayouts: ArtifactLayouts }> {
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
    baseManifest,
  );
  if (
    hasRegisteredComponents(baseManifest) ||
    hasRegisteredComponents(compilation.manifest)
  )
    return {
      ...(await compareComponentCatalogue(
        compilation,
        baseManifest,
        config,
        baseAssetReader,
        assetReader,
        changedPaths,
        baseCommit,
        baseRef,
        options.useFastPath,
      )),
      generatedLayouts: { before: "", after: "" },
    };
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
    new ComponentMaterialReader(baseAssetReader, {
      prefix: baseManifest.schemaVersion === 6 ? ".generated" : "",
      routes: generatedManifestRoutes(baseManifest),
    }),
    new ComponentMaterialReader(
      new CompilationAssetReader(compilation.outputs, assetReader),
      {
        prefix: ".generated",
        routes: generatedManifestRoutes(compilation.manifest),
      },
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
    {
      prefix: baseManifest.schemaVersion === 6 ? ".generated" : "",
      routes: generatedManifestRoutes(baseManifest),
    },
  );
  await copySnapshotDependencies(
    files,
    "after",
    headSeeds,
    async (route) => {
      const generated = compilation.outputs.get(route);
      return generated ?? assetReader.read(route);
    },
    undefined,
    {
      prefix: ".generated",
      routes: generatedManifestRoutes(compilation.manifest),
    },
  );
  const result: ReviewResult = {
    baseCommit,
    baseRef,
    changedPaths,
    ignoredImpact: aggregateIgnored(screens),
    schemaVersion: 2,
    screens,
    sharedImpact,
  };
  return { files, result, generatedLayouts: { before: "", after: "" } };
}

function screenMap(manifest: Manifest): Map<string, ManifestScreen> {
  return new Map(
    manifest.entries
      .filter((entry): entry is ManifestScreen => entry.kind === "screen")
      .map((entry) => [entry.route, entry]),
  );
}
