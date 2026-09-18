import type { ReviewResult } from "@mokly/viewer/data";

import { compileCatalogue } from "../build/compile.js";
import {
  FileSystemGeneratedOutputStore,
  type GeneratedOutputStore,
} from "../build/output_store.js";
import { validateReviewOut } from "../config/path_validation.js";
import type { ResolvedConfig } from "../config/types.js";

import { renderReviewArtifact } from "./artifact.js";
import { compareReview } from "./compare.js";
import type { ReadOnlyReviewRepository } from "./repository.js";
import { writeReviewArtifact } from "./write.js";

/** Build a Git comparison after proving head output is current. */
export async function runReview(
  config: ResolvedConfig,
  baseRef: string,
  outDir: string,
  git: ReadOnlyReviewRepository,
  outputStore: GeneratedOutputStore = new FileSystemGeneratedOutputStore(),
  changedPathExclusions: readonly string[] = [],
): Promise<ReviewResult> {
  validateReviewOut(outDir, config, "Review output", "review-invalid");
  const compilation = await compileCatalogue(config);
  await outputStore.check(compilation, config);
  const artifact = await compareReview(
    compilation,
    config,
    git,
    baseRef,
    outDir,
    undefined,
    changedPathExclusions,
  );
  await writeReviewArtifact(renderReviewArtifact(artifact), outDir, config);
  return artifact.result;
}
