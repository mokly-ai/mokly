import { SystemBaselineClock } from "../../packages/mokly/dist/baseline/clock.js";
import type { BaselineError } from "../../packages/mokly/dist/baseline/errors.js";
import { NodeBaselineFileSystem } from "../../packages/mokly/dist/baseline/filesystem.js";
import { StderrBaselineMaintenanceReporter } from "../../packages/mokly/dist/baseline/maintenance.js";
import { NodeBaselineProcessRunner } from "../../packages/mokly/dist/baseline/process.js";
import { CachedBaselineBuilder } from "../../packages/mokly/dist/baseline/rebuild.js";
import type {
  BaselineBuildRequest,
  BaselineBuilder,
  RebuiltBaseline,
} from "../../packages/mokly/dist/baseline/types.js";

/** One observed preparation, with the signal Serve owns for it. */
export interface ObservedBaselineBuild {
  readonly commit: string;
  readonly signal: AbortSignal | undefined;
}

/** The real Node builder, used when a test needs a usable cache entry. */
export function nodeBaselineBuilder(): BaselineBuilder {
  return new CachedBaselineBuilder(
    new NodeBaselineFileSystem(),
    new NodeBaselineProcessRunner(),
    new SystemBaselineClock(),
    new StderrBaselineMaintenanceReporter(),
    { environment: process.env },
  );
}

/**
 * Hold every rebuild open until the test opens the gate, so a caller can
 * observe `preparing` and cancellation without timing real commands.
 */
export class GatedBaselineBuilder implements BaselineBuilder {
  readonly builds: ObservedBaselineBuild[] = [];
  private waiting: (() => void)[] = [];
  private open = false;
  constructor(
    private readonly inner: BaselineBuilder = nodeBaselineBuilder(),
    private readonly failure?: BaselineError,
  ) {}

  /** Let the held rebuilds, and every later one, continue. */
  releaseAll(): void {
    this.open = true;
    const held = this.waiting;
    this.waiting = [];
    for (const resume of held) resume();
  }

  async build(request: BaselineBuildRequest): Promise<RebuiltBaseline> {
    const { onProgress, ...delegated } = request;
    this.builds.push({ commit: request.commit, signal: request.signal });
    onProgress?.({ type: "start", commit: request.commit });
    if (!this.open) await this.hold(request.signal);
    try {
      request.signal?.throwIfAborted();
      if (this.failure) throw this.failure;
      const built = await this.inner.build(delegated);
      onProgress?.({
        type: "complete",
        commit: built.commit,
        cacheHit: built.cacheHit,
      });
      return built;
    } catch (error) {
      onProgress?.({
        type: "fail",
        commit: request.commit,
        error: error as BaselineError,
      });
      throw error;
    }
  }

  private hold(signal: AbortSignal | undefined): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
      signal?.addEventListener("abort", () => resolve(), { once: true });
      if (signal?.aborted) resolve();
    });
  }
}
