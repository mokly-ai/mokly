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
import type { ChangeEvidence } from "./change_evidence.js";
import { reviewChangedPaths } from "./changed_paths.js";
import { compareComponentCatalogue } from "./component_compare.js";
import { importedChangedPaths } from "./imported_changes.js";
import { readMoveMarkdown } from "./moves/markdown_sources.js";
import type { ReadOnlyReviewRepository } from "./repository.js";

export interface CompareReviewOptions {
  /** Disable the unchanged-view optimization for differential tests. */
  useFastPath?: boolean;
  /** Reuse the exact merged evidence already constructed for export/publication. */
  changeEvidence?: ChangeEvidence;
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
  const authoredPaths = options.changeEvidence
    ? undefined
    : await reviewChangedPaths(
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
  const changedPaths =
    options.changeEvidence ??
    (await importedChangedPaths(
      config,
      baseAssetReader,
      assetReader,
      authoredPaths!,
      compilation.outputs,
      compilation.deliveredStyleSources,
    ));
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
    await readMoveMarkdown(
      baseManifest,
      compilation.manifest,
      config,
      git.sourceReader ?? git.reader,
      baseCommit,
      compilation.documentMarkdown,
    ),
    git.sourceReader ?? git.reader,
  );
}
