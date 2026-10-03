import path from "node:path";

import { generatedViews } from "@mokly/viewer/data";
import type {
  HistoricalManifest,
  ManifestV8,
  ReviewResultV5,
  ScreenResourceEvidence,
  PageResourceEvidence,
} from "@mokly/viewer/data";

import { isIncompatibleEarlierBaseline } from "../baseline/compatibility.js";
import { transferGeneratedFile } from "../build/generated_file.js";
import { ConfiguredGitCommandRunner } from "../config/git.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { errorMessage, isMoklyError } from "../errors.js";
import { changedManifestIds } from "../registry/changed_ids.js";
import { hasRegisteredComponents } from "../registry/manifest_capabilities.js";
import type { AcceptedGeneration } from "../review/accepted_generation.js";
import { GitReviewAssetReader } from "../review/assets.js";
import {
  baselineResourceConfig,
  readBaseManifest,
} from "../review/base_manifest.js";
import type { ChangeEvidence } from "../review/change_evidence.js";
import { reviewChangedPaths } from "../review/changed_paths.js";
import { classifyComponents } from "../review/component_classification.js";
import { CssResourceAnalysis } from "../review/css/resource_analysis.js";
import { EvidenceAssetReader } from "../review/evidence_assets.js";
import { CommittedRepository, type GitCommandRunner } from "../review/git.js";
import { derivedHeadOutputs } from "../review/head_assets.js";
import { importedChangedPaths } from "../review/imported_changes.js";
import {
  baselineReaderForCommit,
  comparisonNotPrepared,
} from "../review/repository.js";
import type { ReadOnlyReviewRepository } from "../review/repository.js";
import type { ReviewEvidence } from "../review/selection_types.js";

import { classifyChangedContent } from "./changed_content.js";
import type { CatalogueChangeClassification } from "./classification_result.js";
import {
  screenViewChanges,
  type ScreenViewChanges,
} from "./screen_view_changes.js";

export interface ComponentChangeSnapshot {
  baseline: HistoricalManifest;
  changedIds?: readonly string[];
  result?: ReviewResultV5;
  comparison?: ReviewEvidence;
  screenEvidence?: readonly ScreenResourceEvidence[];
  pageEvidence?: readonly PageResourceEvidence[];
  screenViews?: readonly ScreenViewChanges[];
}
export interface ComponentChangeSource {
  baseline(): Promise<string>;
  read(commit: string): Promise<ComponentChangeSnapshot | undefined>;
}

/** Background-owned inputs; a prepared commit prevents builds in disposable workers. */
export interface CatalogueClassificationInputs {
  readonly commit?: string;
  readonly generation?: AcceptedGeneration;
}

/** Read-only catalogue classification boundary used outside the HTTP child. */
export interface CatalogueChangeClassifier {
  read(
    config: ResolvedConfig,
    manifest: ManifestV8,
    base: string,
    signal?: AbortSignal,
    accepted?: CatalogueClassificationInputs,
  ): Promise<CatalogueChangeClassification>;
}

/** Classify one generated catalogue against its repository branch point. */
export class RepositoryCatalogueChangeClassifier implements CatalogueChangeClassifier {
  constructor(private readonly commands?: GitCommandRunner) {}

  async read(
    config: ResolvedConfig,
    manifest: ManifestV8,
    base: string,
    signal?: AbortSignal,
    accepted?: CatalogueClassificationInputs,
  ): Promise<CatalogueChangeClassification> {
    let commit = accepted?.commit;
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
      commit = baseline;
      signal?.throwIfAborted();
      return await source.read(baseline);
    } catch (error) {
      if (isIncompatibleEarlierBaseline(error))
        return { kind: "incompatible-earlier", commit: commit ?? base };
      if (isMoklyError(error) && error.code === "manifest-invalid")
        return { kind: "invalid-baseline", diagnostic: errorMessage(error) };
      throw error;
    }
  }
}

/** Production read boundary for a last-good catalogue and its current Git branch point. */
export class RepositoryComponentChanges implements ComponentChangeSource {
  private readonly runner: ConfiguredGitCommandRunner;
  private git: ReadOnlyReviewRepository;
  constructor(
    private readonly config: ResolvedConfig,
    private readonly manifest: ManifestV8,
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
      this.accepted?.generation,
    );
  }
}

/** Classify pages and ownership-aware component views against one pinned baseline. */
export async function readCatalogueChanges(
  config: ResolvedConfig,
  manifest: ManifestV8,
  base: string,
  git: ReadOnlyReviewRepository,
  commit: string,
  accepted?: AcceptedGeneration,
  acceptedEvidence?: ChangeEvidence,
): Promise<ComponentChangeSnapshot> {
  const outputs = await derivedHeadOutputs(config, manifest, accepted?.outputs);
  const baseline = await readBaseManifest(git.reader, commit, config);
  const authoredPaths = acceptedEvidence
    ? undefined
    : await reviewChangedPaths(
        git.evidence,
        commit,
        config,
        config.review.outDir,
      );
  const components =
    hasRegisteredComponents(baseline) || hasRegisteredComponents(manifest);
  const prefix = toPosixPath(path.relative(config.repoRoot, config.mockupsDir));
  const reader = new EvidenceAssetReader(config, outputs);
  const beforeReader = new GitReviewAssetReader(
    baselineResourceConfig(config, baseline),
    git.reader,
    commit,
    prefix,
  );
  const changedPaths =
    acceptedEvidence ??
    (await importedChangedPaths(
      config,
      beforeReader,
      reader,
      authoredPaths!,
      outputs,
      accepted?.deliveredStyleSources,
      accepted?.routes,
    ));
  const cssAnalysis = new CssResourceAnalysis();
  const result = await classifyComponents({
    before: baseline,
    after: manifest,
    config,
    baseCommit: commit,
    baseRef: base,
    changedPaths,
    beforeReader,
    afterReader: reader,
    cssAnalysis,
  });
  const content = await classifyChangedContent(
    manifest,
    baseline,
    config,
    git.reader,
    commit,
    changedPaths,
    reader,
    components ? "pages" : "all",
    cssAnalysis,
    result,
  );
  const pageIds = new Set(
    manifest.entries.flatMap((entry) =>
      entry.kind === "page" ? [entry.id] : [],
    ),
  );
  const ids = changedManifestIds(
    manifest,
    baseline,
    config,
    content.changedPaths,
  ).filter((id) => !components || pageIds.has(id));
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
      ...(outputs
        ? {
            headOutputs: [...outputs].map(
              ([route, content]) =>
                [route, transferGeneratedFile(content)] as const,
            ),
          }
        : {}),
    },
    result,
    screenViews: !components
      ? screenViewChanges(manifest, baseline, config, content.changedPaths)
      : result.screens.map(({ id, views }) => ({
          id,
          views: views.map(({ viewport, colorScheme, state }) => ({
            viewport,
            colorScheme,
            state,
          })),
        })),
    screenEvidence: !components
      ? content.screens
      : result.screens
          .map(({ id, views }) => ({
            id,
            views: views
              .filter(
                (view) =>
                  view.reasons?.length || view.excludedResources?.length,
              )
              .map(({ viewport, colorScheme, reasons, excludedResources }) => ({
                viewport,
                colorScheme,
                ...(reasons ? { reasons } : {}),
                ...(excludedResources ? { excludedResources } : {}),
              })),
          }))
          .filter((entry) => entry.views.length),
    ...(content.pages.length ? { pageEvidence: content.pages } : {}),
    changedIds: [
      ...new Set([
        ...ids,
        ...result.changes.map((entry) => (entry.after ?? entry.before)!.id),
      ]),
    ].sort(),
  };
}
