import path from "node:path";

import { timeAsync } from "../diagnostics/timings.js";
import { errorMessage } from "../errors.js";

import { completedBaseline, removePartialBaseline } from "./cache.js";
import {
  assertMockupsPath,
  cacheLayout,
  DEFAULT_RETAINED_COUNT,
  validCommands,
  type CompletionMarker,
} from "./cache_layout.js";
import { cleanupBaselines } from "./cleanup.js";
import { baselineEnvironment, runBaselineCommands } from "./commands.js";
import { ensureBaselineDirectory } from "./confinement.js";
import { removeBaselineDebris } from "./debris.js";
import {
  discoverHistoricalCatalogue,
  validateBuiltInventory,
} from "./discovery.js";
import { assertBaselineActive, BaselineError } from "./errors.js";
import { extractBaseline } from "./extract.js";
import { harvestHistoricalCatalogue } from "./harvest.js";
import { acquireBaselineLock } from "./lock.js";
import type { BaselineMaintenanceReporter } from "./maintenance.js";
import type {
  BaselineBuilder,
  BaselineBuildRequest,
  BaselineClock,
  BaselineFileSystem,
  BaselineProcessRunner,
  RebuiltBaseline,
} from "./types.js";

export interface BaselineBuilderOptions {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly retainedCount?: number;
  readonly lockTimeoutMs?: number;
}

/** Serialize rebuilding and publish an immutable completed output tree per commit. */
export class CachedBaselineBuilder implements BaselineBuilder {
  constructor(
    private readonly fs: BaselineFileSystem,
    private readonly runner: BaselineProcessRunner,
    private readonly clock: BaselineClock,
    private readonly maintenance: BaselineMaintenanceReporter,
    private readonly options: BaselineBuilderOptions,
  ) {}

  build(request: BaselineBuildRequest): Promise<RebuiltBaseline> {
    return timeAsync(
      "baseline",
      () => this.prepare(request),
      (result) => ({
        cacheHit: result.cacheHit,
      }),
    );
  }

  private async prepare(
    request: BaselineBuildRequest,
  ): Promise<RebuiltBaseline> {
    try {
      assertBaselineActive(request.signal);
      assertMockupsPath(request.mockupsPath);
      if (!validCommands(request.commands))
        throw new BaselineError(
          "baseline-command-failed",
          "Invalid baseline build commands",
        );
      const retained = this.options.retainedCount ?? DEFAULT_RETAINED_COUNT;
      if (!Number.isSafeInteger(retained) || retained < 1)
        throw new Error("Baseline retained count must be a positive integer");
      const layout = cacheLayout(request.repoRoot, request.commit);
      await ensureBaselineDirectory(
        this.fs,
        request.repoRoot,
        layout.entry,
        request.signal,
      );
      const lock = await acquireBaselineLock(
        this.fs,
        this.runner,
        this.clock,
        layout,
        request.signal,
        this.options.lockTimeoutMs,
      );
      let adopted = false;
      let rebuilding = false;
      try {
        assertBaselineActive(request.signal);
        for (const failure of await removeBaselineDebris(
          this.fs,
          this.runner,
          layout,
        ))
          this.maintenance.report(failure);
        const cached = await completedBaseline(this.fs, layout, request);
        if (cached) {
          adopted = true;
          request.onProgress?.({
            type: "complete",
            commit: request.commit,
            cacheHit: true,
          });
          return {
            commit: request.commit,
            outputDir: layout.output,
            marker: cached,
            cacheHit: true,
          };
        }
        request.onProgress?.({ type: "start", commit: request.commit });
        rebuilding = true;
        await removePartialBaseline(this.fs, layout);
        const env = baselineEnvironment(
          this.options.environment,
          request.commit,
        );
        await timeAsync("baseline.extract", () =>
          extractBaseline(
            this.fs,
            this.runner,
            request.repoRoot,
            request.commit,
            layout.source,
            env,
            request.signal,
          ),
        );
        await runBaselineCommands(
          this.runner,
          request.commands,
          layout.source,
          env,
          request.signal,
        );
        const result = await timeAsync(
          "baseline.adopt",
          async (): Promise<RebuiltBaseline> => {
            const selected = await discoverHistoricalCatalogue(
              this.fs,
              layout.source,
              request,
            );
            await validateBuiltInventory(
              this.fs,
              layout.source,
              selected,
              request.signal,
            );
            assertBaselineActive(request.signal);
            await harvestHistoricalCatalogue(
              this.fs,
              layout.source,
              layout.output,
              selected,
              request.signal,
            );
            await this.fs.remove(layout.source);
            assertBaselineActive(request.signal);
            const marker: CompletionMarker = {
              schemaVersion: 1,
              commit: request.commit,
              finishedAt: new Date(this.clock.now()).toISOString(),
              commands: request.commands.map((argv) => [...argv]),
              manifestVersion: selected.version,
              historicalCatalogueRoot: selected.descriptor.catalogueRoot,
              layout: selected.descriptor.layout,
            };
            await this.fs.write(
              path.join(layout.entry, "inputs.json"),
              Buffer.from(JSON.stringify(request.mockupsPath)),
            );
            assertBaselineActive(request.signal);
            await this.fs.write(
              layout.marker,
              Buffer.from(`${JSON.stringify(marker)}\n`),
            );
            adopted = true;
            return {
              commit: request.commit,
              outputDir: layout.output,
              marker,
              cacheHit: false,
            };
          },
        );
        if (!request.signal?.aborted) {
          try {
            for (const failure of await cleanupBaselines(
              this.fs,
              this.runner,
              this.clock,
              layout,
              request,
              retained,
            ))
              this.maintenance.report(failure);
          } catch (error) {
            this.maintenance.report({ entry: layout.root, error });
          }
        }
        request.onProgress?.({
          type: "complete",
          commit: request.commit,
          cacheHit: false,
        });
        return result;
      } finally {
        try {
          if (rebuilding && !adopted)
            await removePartialBaseline(this.fs, layout);
        } catch (error) {
          this.maintenance.report({ entry: layout.entry, error });
        } finally {
          try {
            await lock.release();
          } catch (error) {
            this.maintenance.report({ entry: layout.lock, error });
          }
        }
      }
    } catch (error) {
      const failure = request.signal?.aborted
        ? new BaselineError(
            "baseline-interrupted",
            "Baseline preparation was interrupted",
            error,
          )
        : error instanceof BaselineError
          ? error
          : new BaselineError(
              "baseline-output-invalid",
              `Could not prepare baseline: ${errorMessage(error)}`,
              error,
            );
      request.onProgress?.({
        type: "fail",
        commit: request.commit,
        error: failure,
      });
      throw failure;
    }
  }
}
