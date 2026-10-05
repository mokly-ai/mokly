import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { completedBaseline } from "../../dist/baseline/cache.js";
import { cacheLayout } from "../../dist/baseline/cache_layout.js";
import { SystemBaselineClock } from "../../dist/baseline/clock.js";
import { NodeBaselineFileSystem } from "../../dist/baseline/filesystem.js";
import { StderrBaselineMaintenanceReporter } from "../../dist/baseline/maintenance.js";
import { CachedBaselineBuilder } from "../../dist/baseline/rebuild.js";
import type { BaselineProgress } from "../../dist/baseline/types.js";
import type { ResolvedConfig } from "../../dist/config/types.js";
import { parseHistoricalManifest } from "../../dist/registry/manifest.js";
import { prepareReviewRepository } from "../../dist/review/prepare.js";

import { createSourceExampleBaseline } from "./example_baseline.js";
import { timeBaselinePreparation, timeFixturePhase } from "./fixture_timing.js";
import { createOwnedExample } from "./owned_example.js";
import type { OwnedExample } from "./owned_example.js";

export const EXAMPLE_CONFIG_PATH = "examples/basic/mokly.config.ts";
export const EXAMPLE_CATALOGUE_PATH = "examples/basic";
const execute = promisify(execFile);

export interface PreparedExample extends OwnedExample {
  readonly config: ResolvedConfig;
  readonly commit: string;
}

export interface ExamplePreparationOptions {
  readonly createSource?: (root: string) => Promise<ResolvedConfig>;
  readonly createOwner?: () => Promise<OwnedExample>;
}

/** Prepare an independent real source-only baseline; owns the cold regression. */
export async function prepareIndependentExample(
  fixture: string,
  operationUnderTest = false,
  options: ExamplePreparationOptions = {},
): Promise<PreparedExample> {
  const owned = await (options.createOwner ?? createOwnedExample)();
  try {
    return await owned.prepare(() =>
      buildExampleBaseline(
        owned,
        fixture,
        operationUnderTest,
        options.createSource,
      ),
    );
  } catch (error) {
    return closeExampleAfterFailure(owned, error);
  }
}

/** Run the actual recipe inside the caller-owned deadline and process boundary. */
export async function buildExampleBaseline(
  owned: OwnedExample,
  fixture: string,
  operationUnderTest: boolean,
  createSource: (
    root: string,
  ) => Promise<ResolvedConfig> = createSourceExampleBaseline,
): Promise<PreparedExample> {
  const config = await timeFixturePhase(
    fixture,
    "source-git",
    operationUnderTest,
    () => createSource(owned.root),
  );
  owned.signal.throwIfAborted();
  const commit = await exampleCommit(owned.root);
  await assertSourceOnlyExample(config, commit);
  await assert.rejects(fs.access(cacheLayout(owned.root, commit).marker), {
    code: "ENOENT",
  });
  const progress: BaselineProgress[] = [];
  const prepared = await timeBaselinePreparation(
    fixture,
    () =>
      prepareReviewRepository(config, "HEAD", {
        commit,
        signal: owned.signal,
        builder: exampleBuilder(owned),
        onProgress: (event) => progress.push(event),
      }),
    { operationUnderTest },
  );
  assert.equal(prepared.selection, "rebuild");
  assert.deepEqual(
    progress.map((event) => event.type),
    ["start", "complete"],
  );
  assert.ok(
    progress.some(
      (event) => event.type === "complete" && event.cacheHit === false,
    ),
  );
  assert.equal(prepared.marker?.manifestVersion, 9);
  await prepared.assertUnchanged();
  return { ...owned, config, commit };
}

/** Cleanup never hides the originating error or deletes outside the owner. */
export async function closeExampleAfterFailure(
  owned: OwnedExample,
  error: unknown,
): Promise<never> {
  const failures: unknown[] = [error];
  await owned.close().catch((cleanup: unknown) => {
    failures.push(cleanup);
  });
  if (failures.length > 1)
    throw new AggregateError(failures, "Example setup and cleanup failed", {
      cause: error,
    });
  throw error;
}

/** Existing completion validation verifies recipe, inventory and closure before export. */
export async function validateWarmExample(
  config: ResolvedConfig,
  commit: string,
): Promise<void> {
  assert.equal(await exampleCommit(config.repoRoot), commit);
  const marker = await completedBaseline(
    new NodeBaselineFileSystem(),
    cacheLayout(config.repoRoot, commit),
    {
      repoRoot: config.repoRoot,
      commit,
      mockupsPath: EXAMPLE_CATALOGUE_PATH,
      commands: config.review.baselineBuild ?? [],
    },
  );
  assert.equal(
    marker?.manifestVersion,
    9,
    "A complete warm example baseline is required; no fixture fallback is allowed",
  );
  const manifest = parseHistoricalManifest(
    JSON.parse(
      await fs.readFile(
        path.join(
          cacheLayout(config.repoRoot, commit).output,
          EXAMPLE_CATALOGUE_PATH,
          "mokly-generated/mokly-manifest.json",
        ),
        "utf8",
      ),
    ),
  );
  assert.equal(manifest.schemaVersion, 9);
}

export async function exampleCommit(root: string): Promise<string> {
  return (
    await execute("git", ["rev-parse", "HEAD"], { cwd: root })
  ).stdout.trim();
}

export async function assertSourceOnlyExample(
  config: ResolvedConfig,
  commit: string,
): Promise<void> {
  const { stdout } = await execute(
    "git",
    ["ls-tree", "-r", "--name-only", commit, "examples/basic/mokly-generated"],
    { cwd: config.repoRoot },
  );
  assert.equal(
    stdout,
    "",
    "The example baseline must not track generated output",
  );
  await assert.rejects(fs.access(config.generatedDir), { code: "ENOENT" });
}

export function exampleBuilder(owned: OwnedExample): CachedBaselineBuilder {
  return new CachedBaselineBuilder(
    new NodeBaselineFileSystem(),
    owned.runner,
    new SystemBaselineClock(),
    new StderrBaselineMaintenanceReporter(),
    { environment: owned.environment },
  );
}
