/** Configure Serve's repository-backed complete and selected Review providers. */
import type { ResolvedConfig } from "../config/types.js";
import { RepositoryRemovedPagePreview } from "../review/page_preview.js";
import type { ReadOnlyReviewRepository } from "../review/repository.js";
import { runReview } from "../review/run.js";
import { RepositorySelectedReview } from "../review/selected.js";
import type {
  RemovedPagePreviewProvider,
  SelectedReviewProvider,
} from "../review/selection_types.js";

import type { ReviewArtifactProvider } from "./review_generations.js";
import type { ReviewRepositorySource } from "./review_repository.js";

/** How Browse obtains the Review artifact it serves under `/__mokly/diffs/`. */
export interface ServedReview extends ReviewArtifactProvider {
  /** Comparison base ref, shown when the comparison cannot be generated. */
  base: string;
  selected?: SelectedReviewProvider;
  pagePreview?: RemovedPagePreviewProvider;
  repository?(): ReadOnlyReviewRepository;
}

/** Serve the configured Git comparison from the consumer's Review engine. */
export function configuredServedReview(
  config: ResolvedConfig,
  base: string,
  git: ReadOnlyReviewRepository | ReviewRepositorySource,
): ServedReview {
  const repository = () => ("current" in git ? git.current() : git);
  return {
    base,
    repository,
    selected: new RepositorySelectedReview(
      config,
      "current" in git ? undefined : git.reader,
    ),
    pagePreview: {
      generate: (source, selection, signal) =>
        new RepositoryRemovedPagePreview(config, repository().reader).generate(
          source,
          selection,
          signal,
        ),
    },
    async generate(options): Promise<void> {
      await runReview(
        config,
        base,
        config.review.outDir,
        repository(),
        undefined,
        options.changedPathExclusions,
      );
    },
    outDir: config.review.outDir,
  };
}
