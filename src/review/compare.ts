import path from "node:path";

import type { ReviewArtifact } from "@mokly/viewer/data";

import type { Compilation } from "../build/compile.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
  type ReviewAssetReader,
} from "./assets.js";
import { baselineResourceConfig, readBaseManifest } from "./base_manifest.js";
import { reviewChangedPaths } from "./changed_paths.js";
import { compareComponentCatalogue } from "./component_compare.js";
import type { ReadOnlyReviewRepository } from "./repository.js";

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
  assetReader: ReviewAssetReader = new FileSystemReviewAssetReader(config),
  changedPathExclusions: readonly string[] = [],
  options: CompareReviewOptions = {},
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
  return compareComponentCatalogue(
    compilation,
    baseManifest,
    config,
    baseAssetReader,
    assetReader,
    changedPaths,
    baseCommit,
    baseRef,
    options.useFastPath,
  );
}
