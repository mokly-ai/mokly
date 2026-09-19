import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { completedBaseline } from "../baseline/cache.js";
import { cacheLayout } from "../baseline/cache_layout.js";
import type { CompletionMarker } from "../baseline/cache_layout.js";
import { SystemBaselineClock } from "../baseline/clock.js";
import { assertBaselineActive, BaselineError } from "../baseline/errors.js";
import { NodeBaselineFileSystem } from "../baseline/filesystem.js";
import { StderrBaselineMaintenanceReporter } from "../baseline/maintenance.js";
import { NodeBaselineProcessRunner } from "../baseline/process.js";
import { CachedBaselineBuilder } from "../baseline/rebuild.js";
import type {
  BaselineBuilder,
  BaselineFileSystem,
  BaselineProgress,
} from "../baseline/types.js";
import { ConfiguredGitCommandRunner } from "../config/git.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";

import type { GitCommandRunner } from "./git.js";
import { GitRepositoryEvidence } from "./git_evidence.js";
import {
  readOnlyRepositoryForCommit,
  type ReadOnlyReviewRepository,
} from "./repository.js";

export interface BaselinePreparationOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (event: BaselineProgress) => void;
  readonly runner?: GitCommandRunner;
  readonly builder?: BaselineBuilder;
  readonly filesystem?: BaselineFileSystem;
  readonly diagnostic?: (message: string) => void;
  /** Already resolved by a caller that owns this baseline's lifetime. */
  readonly commit?: string;
}

const preparedRepository = Symbol("prepared review repository");

export interface PreparedReviewRepository extends ReadOnlyReviewRepository {
  readonly [preparedRepository]: true;
  readonly marker: CompletionMarker | undefined;
  readonly commit: string;
  /** Validate retained cache identity again before installing an export. */
  assertUnchanged(): Promise<void>;
}

/** Composition boundary for CLI, background Serve and publication; never call from HTTP. */
export async function prepareReviewRepository(
  config: ResolvedConfig,
  base: string,
  options: BaselinePreparationOptions = {},
): Promise<PreparedReviewRepository> {
  const runner = new ConfiguredGitCommandRunner(
    config,
    options.signal,
    options.runner,
  );
  const evidence = new GitRepositoryEvidence(runner);
  let commit: string;
  try {
    commit = await timeAsync("baseline.resolve", async () => {
      options.signal?.throwIfAborted();
      await runner.requireTopLevel();
      return options.commit ?? (await evidence.mergeBase(base, "HEAD"));
    });
  } catch (error) {
    if (
      config.generatedOutput !== "derived" ||
      (error instanceof MoklyError && error.code === "config-invalid")
    )
      throw error;
    assertBaselineActive(options.signal);
    throw new BaselineError(
      "baseline-history-unavailable",
      `Could not resolve the branch point for ${base}`,
      error,
    );
  }
  const maintenance = new StderrBaselineMaintenanceReporter(
    options.diagnostic
      ? (line) => options.diagnostic!(line.replace(/\n$/, ""))
      : undefined,
  );
  const filesystem =
    options.filesystem ?? new NodeBaselineFileSystem(maintenance);
  const request = {
    repoRoot: config.repoRoot,
    commit,
    mockupsPath: toPosixPath(path.relative(config.repoRoot, config.mockupsDir)),
    commands: config.review.baselineBuild ?? [],
    allowManifestV2: config.compatibility.readManifestV2,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
  };
  const rebuilt =
    config.generatedOutput === "derived"
      ? await (
          options.builder ??
          new CachedBaselineBuilder(
            filesystem,
            new NodeBaselineProcessRunner(),
            new SystemBaselineClock(),
            maintenance,
            { environment: process.env },
          )
        ).build(request)
      : undefined;
  return {
    commit,
    [preparedRepository]: true,
    marker: rebuilt?.marker,
    ...readOnlyRepositoryForCommit(
      config,
      commit,
      runner,
      options.signal,
      filesystem,
    ),
    async assertUnchanged() {
      if (!rebuilt) return;
      assertBaselineActive(options.signal);
      const marker = await completedBaseline(
        filesystem,
        cacheLayout(config.repoRoot, commit),
        request,
      );
      if (!marker || !isDeepStrictEqual(marker, rebuilt.marker))
        throw new BaselineError(
          "baseline-output-invalid",
          `Prepared baseline changed during export: ${commit}`,
        );
    },
  };
}
