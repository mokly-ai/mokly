import path from "node:path";

import { generatedViews } from "@mokly/viewer/data";
import type {
  Manifest,
  ReviewResultV3,
  ScreenResourceEvidence,
} from "@mokly/viewer/data";

import { ConfiguredGitCommandRunner } from "../config/git.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { changedManifestRoutes } from "../registry/changed_routes.js";
import { hasRegisteredComponents } from "../registry/manifest_capabilities.js";
import { GitReviewAssetReader } from "../review/assets.js";
import {
  baselineResourceConfig,
  readBaseManifest,
} from "../review/base_manifest.js";
import { reviewChangedPaths } from "../review/changed_paths.js";
import { classifyComponents } from "../review/component_classification.js";
import { EvidenceAssetReader } from "../review/evidence_assets.js";
import { CommittedRepository, type GitCommandRunner } from "../review/git.js";
import { derivedHeadOutputs } from "../review/head_assets.js";
import {
  baselineReaderForCommit,
  comparisonNotPrepared,
} from "../review/repository.js";
import type { ReadOnlyReviewRepository } from "../review/repository.js";
import type { ReviewEvidence } from "../review/selection_types.js";

import { classifyChangedContent } from "./changed_content.js";
import {
  screenViewChanges,
  type ScreenViewChanges,
} from "./screen_view_changes.js";

export interface ComponentChangeSnapshot {
  baseline: Manifest;
  changedRoutes?: readonly string[];
  result?: ReviewResultV3;
  comparison?: ReviewEvidence;
  screenEvidence?: readonly ScreenResourceEvidence[];
  screenViews?: readonly ScreenViewChanges[];
}
export interface ComponentChangeSource {
  baseline(): Promise<string>;
  read(commit: string): Promise<ComponentChangeSnapshot | undefined>;
}

/** Background-owned inputs; a prepared commit prevents builds in disposable workers. */
export interface CatalogueClassificationInputs {
  readonly commit?: string;
  readonly outputs?: ReadonlyMap<string, string>;
}

/** Read-only catalogue classification boundary used outside the HTTP child. */
export interface CatalogueChangeClassifier {
  read(
    config: ResolvedConfig,
    manifest: Manifest,
    base: string,
    signal?: AbortSignal,
    accepted?: CatalogueClassificationInputs,
  ): Promise<ComponentChangeSnapshot | undefined>;
}

/** Classify one generated catalogue against its repository branch point. */
export class RepositoryCatalogueChangeClassifier implements CatalogueChangeClassifier {
  constructor(private readonly commands?: GitCommandRunner) {}

  async read(
    config: ResolvedConfig,
    manifest: Manifest,
    base: string,
    signal?: AbortSignal,
    accepted?: CatalogueClassificationInputs,
  ): Promise<ComponentChangeSnapshot | undefined> {
    try {
      const source = new RepositoryComponentChanges(
        config,
        manifest,
        base,
        signal,
        this.commands,
        accepted,
      );
      signal?.throwIfAborted();
      const baseline = await source.baseline();
      signal?.throwIfAborted();
      return await source.read(baseline);
    } catch {
      return undefined;
    }
  }
}

/** Retain one immutable classification; resolving the baseline never creates Review artifacts. */
export class ComponentChangeCache {
  private cached:
    | {
        sequence: number;
        key: string;
        result: Promise<ComponentChangeSnapshot | undefined>;
      }
    | undefined;
  private epoch = 0;
  private sequence = 0;
  constructor(private readonly source: ComponentChangeSource) {}
  invalidate(): void {
    this.epoch++;
    this.cached = undefined;
  }
  async read(generation: number): Promise<ComponentChangeSnapshot | undefined> {
    const epoch = this.epoch;
    const sequence = ++this.sequence;
    try {
      const baseline = await this.source.baseline();
      const key = `${epoch}:${generation}:${baseline}`;
      if (this.cached?.key === key) return this.cached.result;
      const result = this.source.read(baseline).catch(() => undefined);
      if (epoch === this.epoch && sequence >= (this.cached?.sequence ?? 0))
        this.cached = { sequence, key, result };
      return result;
    } catch {
      return undefined;
    }
  }
}

/** Production read boundary for a last-good catalogue and its current Git branch point. */
export class RepositoryComponentChanges implements ComponentChangeSource {
  private readonly runner: ConfiguredGitCommandRunner;
  private git: ReadOnlyReviewRepository;
  constructor(
    private readonly config: ResolvedConfig,
    private readonly manifest: Manifest,
    private readonly base: string,
    private readonly signal?: AbortSignal,
    commands?: GitCommandRunner,
    private readonly accepted?: CatalogueClassificationInputs,
  ) {
    this.runner = new ConfiguredGitCommandRunner(config, signal, commands);
    this.git = new CommittedRepository(this.runner);
  }
  async baseline(): Promise<string> {
    await this.runner.requireTopLevel();
    if (this.accepted?.commit) {
      this.git = {
        ...this.git,
        reader: baselineReaderForCommit(
          this.config,
          this.accepted.commit,
          this.runner,
          this.signal,
        ),
      };
      return this.accepted.commit;
    }
    if (this.config.generatedOutput === "derived")
      throw comparisonNotPrepared();
    return this.git.evidence.mergeBase(this.base, "HEAD");
  }
  async read(commit: string): Promise<ComponentChangeSnapshot | undefined> {
    return readCatalogueChanges(
      this.config,
      this.manifest,
      this.base,
      this.git,
      commit,
      this.accepted?.outputs,
    );
  }
}

/** Classify pages and ownership-aware component views against one pinned baseline. */
export async function readCatalogueChanges(
  config: ResolvedConfig,
  manifest: Manifest,
  base: string,
  git: ReadOnlyReviewRepository,
  commit: string,
  outputs?: ReadonlyMap<string, string>,
): Promise<ComponentChangeSnapshot> {
  outputs = await derivedHeadOutputs(config, manifest, outputs);
  const baseline = await readBaseManifest(git.reader, commit, config);
  const changedPaths = await reviewChangedPaths(
    git.evidence,
    commit,
    config,
    config.review.outDir,
  );
  const components =
    hasRegisteredComponents(baseline) || hasRegisteredComponents(manifest);
  const prefix = toPosixPath(path.relative(config.repoRoot, config.mockupsDir));
  const reader = new EvidenceAssetReader(config, outputs);
  const result = components
    ? await classifyComponents({
        before: baseline,
        after: manifest,
        config,
        baseCommit: commit,
        baseRef: base,
        changedPaths,
        beforeReader: new GitReviewAssetReader(
          baselineResourceConfig(config, baseline),
          git.reader,
          commit,
          prefix,
        ),
        afterReader: reader,
      })
    : undefined;
  const content = await classifyChangedContent(
    manifest,
    baseline,
    config,
    git.reader,
    commit,
    changedPaths,
    reader,
    components ? "pages" : "all",
  );
  const pageRoutes = new Set(
    manifest.entries.flatMap((entry) =>
      entry.kind === "page" ? [entry.route] : [],
    ),
  );
  const routes = changedManifestRoutes(
    manifest,
    baseline,
    config,
    content.changedPaths,
  ).filter((route) => !components || pageRoutes.has(route));
  for (const entry of manifest.entries)
    for (const view of generatedViews(entry))
      if (!reader.digests[view.path]) await reader.read(view.path);
  return {
    baseline,
    comparison: {
      baseCommit: commit,
      baseRef: base,
      changedPaths,
      headDigests: reader.digests,
      ...(outputs ? { headOutputs: [...outputs] } : {}),
    },
    ...(result ? { result } : {}),
    ...(!components
      ? {
          screenViews: screenViewChanges(
            manifest,
            baseline,
            config,
            content.changedPaths,
          ),
        }
      : {}),
    ...(!components && content.screens.length
      ? { screenEvidence: content.screens }
      : {}),
    changedRoutes: [
      ...new Set([
        ...routes,
        ...(result?.changes.map(
          (entry) => (entry.after ?? entry.before)!.route,
        ) ?? []),
      ]),
    ].sort(),
  };
}
