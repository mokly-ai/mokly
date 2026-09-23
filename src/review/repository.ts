/** Read capabilities for comparisons; this module cannot construct a builder. */
import path from "node:path";

import { cacheLayout } from "../baseline/cache_layout.js";
import { NodeBaselineFileSystem } from "../baseline/filesystem.js";
import { RebuiltBaselineReader } from "../baseline/reader.js";
import type { BaselineFileSystem } from "../baseline/types.js";
import { ConfiguredGitCommandRunner } from "../config/git.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { CommittedBaselineReader } from "./committed.js";
import {
  CommittedRepository,
  type RepositoryEvidence,
  type BaselineReader,
  type GitCommandRunner,
} from "./git.js";
import { GitRepositoryEvidence } from "./git_evidence.js";

/** Evidence and historical bytes only; no preparation or build capability. */
export interface ReadOnlyReviewRepository {
  readonly evidence: RepositoryEvidence;
  readonly reader: BaselineReader;
}

/** Only the parent preparation boundary chooses which historical reader to open. */
export type BaselineSelection = "blobs" | "rebuild";

/** Explicit Git-blob fixture adapter; production comparisons prepare per commit. */
export function committedReviewRepository(
  config: ResolvedConfig,
  runner: GitCommandRunner = new ConfiguredGitCommandRunner(config),
): ReadOnlyReviewRepository {
  return new CommittedRepository(runner);
}

export function comparisonNotPrepared(): MoklyError {
  return new MoklyError("review-invalid", "The comparison is not prepared");
}

/** Open a parent-prepared commit without resolving a ref or running a build. */
export function readOnlyRepositoryForCommit(
  config: ResolvedConfig,
  commit: string,
  selection: BaselineSelection,
  runner: GitCommandRunner = new ConfiguredGitCommandRunner(config),
  signal?: AbortSignal,
  filesystem: BaselineFileSystem = new NodeBaselineFileSystem(),
): ReadOnlyReviewRepository {
  const evidence = new GitRepositoryEvidence(runner);
  return {
    evidence: {
      mergeBase: async () => commit,
      changedPaths: (baseCommit, excluded) =>
        evidence.changedPaths(baseCommit, excluded),
    },
    reader: baselineReaderForCommit(
      config,
      commit,
      selection,
      runner,
      signal,
      filesystem,
    ),
  };
}

/** Select a reader for an already prepared commit; this never starts a build. */
export function baselineReaderForCommit(
  config: ResolvedConfig,
  commit: string,
  selection: BaselineSelection,
  runner: GitCommandRunner = new ConfiguredGitCommandRunner(config),
  signal?: AbortSignal,
  filesystem: BaselineFileSystem = new NodeBaselineFileSystem(),
): BaselineReader {
  return selection === "rebuild"
    ? new RebuiltBaselineReader(
        filesystem,
        config.repoRoot,
        cacheLayout(config.repoRoot, commit).output,
        commit,
        toPosixPath(path.relative(config.repoRoot, config.mockupsDir)),
        signal,
      )
    : new CommittedBaselineReader(runner);
}
