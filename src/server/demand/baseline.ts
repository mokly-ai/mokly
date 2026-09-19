/** A historical build outlives content generations and is cancelled only when its inputs change. */
import { assertBaselineActive, BaselineError } from "../../baseline/errors.js";
import type {
  BaselineBuilder,
  BaselineProgress,
} from "../../baseline/types.js";
import { ConfiguredGitCommandRunner } from "../../config/git.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";
import { GitRepositoryEvidence } from "../../review/git_evidence.js";
import {
  prepareReviewRepository,
  type PreparedReviewRepository,
} from "../../review/prepare.js";

interface Preparation {
  readonly key: string;
  readonly commit: string;
  readonly controller: AbortController;
  readonly result: Promise<PreparedReviewRepository>;
}

export class BackgroundBaseline {
  private active: Preparation | undefined;
  private preparing = false;
  constructor(
    private readonly statusChanged?: (status: "preparing" | "pending") => void,
    private readonly revoked?: (commit: null) => void,
    private readonly builder?: BaselineBuilder,
    private readonly progressChanged?: (event: BaselineProgress) => void,
    private readonly diagnostic?: (message: string) => void,
  ) {}

  get status(): "preparing" | "pending" {
    return this.preparing ? "preparing" : "pending";
  }

  async prepare(
    config: ResolvedConfig,
    base: string,
    signal: AbortSignal,
  ): Promise<PreparedReviewRepository> {
    const key = preparationKey(config);
    let commit: string;
    try {
      commit = await new GitRepositoryEvidence(
        new ConfiguredGitCommandRunner(config, signal),
      ).mergeBase(base, "HEAD");
    } catch (error) {
      assertBaselineActive(signal);
      await this.close();
      if (error instanceof MoklyError && error.code === "config-invalid")
        throw error;
      throw new BaselineError(
        "baseline-history-unavailable",
        `Could not resolve the branch point for ${base}`,
        error,
      );
    }
    signal.throwIfAborted();
    if (this.active?.key !== key || this.active.commit !== commit) {
      await this.close();
      signal.throwIfAborted();
      const controller = new AbortController();
      const result = prepareReviewRepository(config, base, {
        commit,
        signal: controller.signal,
        onProgress: (event) => this.progress(controller, event),
        ...(this.builder ? { builder: this.builder } : {}),
        ...(this.diagnostic ? { diagnostic: this.diagnostic } : {}),
      });
      this.active = { key, commit, controller, result };
      void result.catch(() => {
        if (this.active?.controller === controller) {
          this.active = undefined;
          this.preparing = false;
        }
      });
    }
    return untilAborted(this.active.result, signal);
  }

  async reconfigure(config: ResolvedConfig): Promise<void> {
    if (this.active && this.active.key !== preparationKey(config))
      await this.close();
  }

  async close(): Promise<void> {
    const previous = this.active;
    this.active = undefined;
    this.preparing = false;
    if (!previous) return;
    previous.controller.abort();
    this.revoked?.(null);
    await previous.result.catch(() => {});
  }

  private progress(controller: AbortController, event: BaselineProgress): void {
    if (
      this.active?.controller !== controller ||
      controller.signal.aborted ||
      event.type === "fail"
    )
      return;
    this.progressChanged?.(event);
    if (event.type === "start") {
      this.preparing = true;
      this.statusChanged?.("preparing");
    } else if (this.preparing) {
      this.preparing = false;
      this.statusChanged?.("pending");
    }
  }
}

function preparationKey(config: ResolvedConfig): string {
  return JSON.stringify([
    config.generatedOutput,
    config.repoRoot,
    config.configPath,
    config.mockupsDir,
    config.review.baselineBuild,
    config.compatibility.readManifestV2,
  ]);
}

/** Stop waiting for a superseded content generation without cancelling shared preparation. */
function untilAborted(
  result: Promise<PreparedReviewRepository>,
  signal: AbortSignal,
): Promise<PreparedReviewRepository> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    void result
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
