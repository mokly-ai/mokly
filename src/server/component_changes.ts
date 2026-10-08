import path from "node:path";

import type { ManifestV10 } from "@mokly/viewer/data";

import { isIncompatibleEarlierBaseline } from "../baseline/compatibility.js";
import { ConfiguredGitCommandRunner } from "../config/git.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { errorMessage, isMoklyError } from "../errors.js";
import { changedManifestPaths } from "../registry/changed_paths.js";
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
import type { GitCommandRunner } from "../review/git.js";
import { CommittedRepository } from "../review/git.js";
import { compiledHeadOutputs } from "../review/head_assets.js";
import { importedChangedPaths } from "../review/imported_changes.js";
import { readMoveMarkdown } from "../review/moves/markdown_sources.js";
import { prepareMoveClassification } from "../review/moves/prepare.js";
import {
  baselineReaderForCommit,
  comparisonNotPrepared,
} from "../review/repository.js";
import type { ReadOnlyReviewRepository } from "../review/repository.js";

import { classifyChangedContent } from "./changed_content.js";
import type { CatalogueChangeClassification } from "./classification_result.js";
import {
  retainHeadViewDigests,
  transferredHeadOutputs,
} from "./comparison_capture.js";
import type {
  CatalogueChangeClassifier,
  CatalogueClassificationInputs,
  ComponentChangeSnapshot,
  ComponentChangeSource,
} from "./component_change_types.js";
import {
  screenViewChanges,
  screenResultEvidence,
} from "./screen_view_changes.js";

/** Classify one generated catalogue against its repository branch point. */
export class RepositoryCatalogueChangeClassifier implements CatalogueChangeClassifier {
  constructor(private readonly commands?: GitCommandRunner) {}

  async read(
    config: ResolvedConfig,
    manifest: ManifestV10,
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
    private readonly manifest: ManifestV10,
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
    if (this.accepted?.commit && this.accepted.selection) {
      this.git = {
        ...this.git,
        reader: baselineReaderForCommit(
          this.config,
          this.accepted.commit,
          this.accepted.selection,
          this.runner,
          this.signal,
          undefined,
          this.accepted.descriptor,
        ),
      };
      return this.accepted.commit;
    }
    throw comparisonNotPrepared();
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
  manifest: ManifestV10,
  base: string,
  git: ReadOnlyReviewRepository,
  commit: string,
  accepted?: AcceptedGeneration,
  acceptedEvidence?: ChangeEvidence,
): Promise<ComponentChangeSnapshot> {
  const outputs = await compiledHeadOutputs(
    config,
    manifest,
    accepted?.outputs,
  );
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
    baseline,
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
  const prepared = await prepareMoveClassification({
    before: baseline,
    after: manifest,
    config,
    baseCommit: commit,
    baseRef: base,
    changedPaths,
    beforeReader,
    afterReader: reader,
    cssAnalysis,
    sourceReader: git.sourceReader ?? git.reader,
    markdown: await readMoveMarkdown(
      baseline,
      manifest,
      config,
      git.sourceReader ?? git.reader,
      commit,
      accepted?.documentMarkdown,
    ),
  });
  const result = await classifyComponents(prepared);
  const content = await classifyChangedContent(
    manifest,
    baseline,
    config,
    git.reader,
    commit,
    changedPaths,
    reader,
    components ? "pages" : "all",
    {
      pairing: prepared.pairing,
      beforeReader: prepared.beforeReader,
      ...(prepared.resources ? { resources: prepared.resources } : {}),
    },
    cssAnalysis,
    result,
  );
  const pageIds = new Set(
    manifest.entries.flatMap((entry) =>
      entry.kind === "page" || entry.kind === "document" ? [entry.path] : [],
    ),
  );
  const ids = changedManifestPaths(
    manifest,
    baseline,
    config,
    content.changedPaths,
    prepared.pairing.moves,
  ).filter((id) => !components || pageIds.has(id));
  await retainHeadViewDigests(manifest, reader);
  return {
    baseline,
    pairing: prepared.pairing,
    comparison: {
      baseCommit: commit,
      baseRef: base,
      changedPaths,
      headDigests: reader.digests,
      ...(outputs
        ? {
            headOutputs: transferredHeadOutputs(outputs),
          }
        : {}),
    },
    result,
    ...(components
      ? screenResultEvidence(result)
      : {
          screenViews: screenViewChanges(
            manifest,
            baseline,
            config,
            content.changedPaths,
            prepared.pairing.moves,
          ),
          screenEvidence: content.screens,
        }),
    ...(content.pages.length ? { pageEvidence: content.pages } : {}),
    changedEntries: [
      ...new Set([
        ...ids,
        ...result.changes
          .filter((entry) => entry.reasons.length > 0)
          .map((entry) => (entry.after ?? entry.before)!.path),
      ]),
    ].sort(),
  };
}
