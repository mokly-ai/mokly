/** HTTP-owned reader state. Only the parent can prepare the supplied commit. */
import type { ResolvedConfig } from "../config/types.js";
import {
  comparisonNotPrepared,
  readOnlyRepositoryForCommit,
  type BaselineSelection,
  type ReadOnlyReviewRepository,
} from "../review/repository.js";

export interface ReviewRepositorySource {
  current(): ReadOnlyReviewRepository;
}

export class ServedReviewRepository implements ReviewRepositorySource {
  private repository: ReadOnlyReviewRepository | undefined;
  private version: number;

  constructor(
    private readonly config: ResolvedConfig,
    version = 0,
  ) {
    this.version = version;
  }

  current(): ReadOnlyReviewRepository {
    if (!this.repository) throw comparisonNotPrepared();
    return this.repository;
  }

  /** Ignore superseded handoffs; null revokes a previously accepted reader. */
  accept(
    commit: string | null | undefined,
    version = this.version + 1,
    selection?: BaselineSelection,
  ): void {
    if (version <= this.version) return;
    this.version = version;
    if (commit === undefined) return;
    if (commit && !selection) throw comparisonNotPrepared();
    this.repository =
      commit && selection
        ? readOnlyRepositoryForCommit(this.config, commit, selection)
        : undefined;
  }
}
