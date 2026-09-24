import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { completedBaseline } from "../baseline/cache.js";
import { cacheLayout } from "../baseline/cache_layout.js";
import type { CompletionMarker } from "../baseline/cache_layout.js";
import {
  baselineCatalogue,
  joinCataloguePath,
  type BaselineCatalogue,
} from "../baseline/catalogue.js";
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
import {
  FORMER_MANIFEST_NAME,
  LEGACY_MANIFEST_NAME,
  MANIFEST_NAME,
  parseHistoricalManifest,
} from "../registry/manifest.js";

import { CommittedBaselineReader } from "./committed.js";
import type { GitCommandRunner } from "./git.js";
import { GitRepositoryEvidence } from "./git_evidence.js";
import {
  readOnlyRepositoryForCommit,
  type BaselineSelection,
  type ReadOnlyReviewRepository,
} from "./repository.js";
import {
  incompleteGeneratedInventory,
  inventoryDiagnostic,
  readCommitTree,
  treeEntryKind,
} from "./tree_inventory.js";

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
  readonly selection: BaselineSelection;
  readonly descriptor: BaselineCatalogue;
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
    if (error instanceof MoklyError && error.code === "config-invalid")
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
  const prefix =
    toPosixPath(path.relative(config.repoRoot, config.mockupsDir)) || ".";
  const blobReader = new CommittedBaselineReader(runner);
  let selection: BaselineSelection = "rebuild";
  let descriptor = baselineCatalogue(commit, prefix, "generated-v6");
  const tree = await readCommitTree(runner, commit);
  for (const filename of [
    `.generated/${MANIFEST_NAME}`,
    MANIFEST_NAME,
    FORMER_MANIFEST_NAME,
    ...(config.compatibility.readManifestV2 ? [LEGACY_MANIFEST_NAME] : []),
  ]) {
    const candidate = joinCataloguePath(prefix, filename);
    const kind = treeEntryKind(tree.get(candidate));
    if (kind === "missing") continue;
    if (kind !== "regular")
      throw new MoklyError(
        "manifest-invalid",
        `historical manifest is not a regular file: ${candidate}`,
      );
    try {
      const manifest = parseHistoricalManifest(
        JSON.parse(await blobReader.readFile(commit, candidate)),
        filename === LEGACY_MANIFEST_NAME,
      );
      const layout = filename.startsWith(".generated/")
        ? "generated-v6"
        : "legacy";
      if (layout === "generated-v6" && manifest.schemaVersion !== 6)
        throw new MoklyError(
          "manifest-invalid",
          `historical manifest is not v6: ${candidate}`,
        );
      descriptor = baselineCatalogue(commit, prefix, layout);
      if (manifest.schemaVersion === 6 && "generatedFiles" in manifest) {
        const issue = incompleteGeneratedInventory(tree, descriptor, manifest);
        if (issue) {
          const line = inventoryDiagnostic(commit, issue);
          if (options.diagnostic) options.diagnostic(line);
          else process.stderr.write(`${line}\n`);
          break;
        }
      }
    } catch (error) {
      if (error instanceof MoklyError) throw error;
      throw new MoklyError(
        "manifest-invalid",
        `invalid historical manifest: ${candidate}`,
        { cause: error },
      );
    }
    selection = "blobs";
    break;
  }
  const request = {
    repoRoot: config.repoRoot,
    commit,
    mockupsPath: prefix,
    commands: config.review.baselineBuild ?? [],
    allowManifestV2: config.compatibility.readManifestV2,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
  };
  const rebuilt =
    selection === "rebuild"
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
  if (rebuilt?.marker.historicalCatalogueRoot && rebuilt.marker.layout)
    descriptor = baselineCatalogue(
      commit,
      rebuilt.marker.historicalCatalogueRoot,
      rebuilt.marker.layout,
    );
  return {
    commit,
    selection,
    descriptor,
    [preparedRepository]: true,
    marker: rebuilt?.marker,
    ...readOnlyRepositoryForCommit(
      config,
      commit,
      selection,
      runner,
      options.signal,
      filesystem,
      descriptor,
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
