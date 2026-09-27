/** Capture one selection from the accepted catalogue without another exhaustive build. */
import path from "node:path";

import { minimatch } from "minimatch";

import {
  generatedViews,
  isManifestComponentVariant,
  parseReviewResult,
  viewRoute,
} from "@mokly/viewer/data";
import type {
  HistoricalManifestScreen,
  Manifest,
  ManifestScreen,
  ReviewArtifact,
  ReviewArtifactContent,
  ReviewResult,
} from "@mokly/viewer/data";

import { ConfiguredGitCommandRunner } from "../config/git.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { copySnapshotDependencies, GitReviewAssetReader } from "./assets.js";
import { baselineResourceConfig } from "./base_manifest.js";
import { ComponentMaterialReader } from "./component_resources.js";
import { SelectedAssetReader } from "./evidence_assets.js";
import type { BaselineReader } from "./git.js";
import { CompiledReviewAssetReader } from "./head_assets.js";
import { relocateHistoricalDocument } from "./historical_document.js";
import { baselineReaderForCommit } from "./repository.js";
import { ResourceComparison } from "./resource_comparison.js";
import { compareScreen } from "./screen_compare.js";
import { aggregateIgnored, fragmentRoutes } from "./screen_views.js";
import {
  missingSelection,
  selectedComponentResult,
} from "./selection_result.js";
import type {
  ReviewSelection,
  SelectedReviewProvider,
  SelectedReviewSource,
} from "./selection_types.js";

export class RepositorySelectedReview implements SelectedReviewProvider {
  constructor(
    private readonly config: ResolvedConfig,
    private readonly git?: BaselineReader,
  ) {}

  async generate(
    source: SelectedReviewSource,
    selection: ReviewSelection,
    signal: AbortSignal,
  ): Promise<ReviewArtifact> {
    if (this.config.generatedOutput === "derived" && !source.headOutputs)
      throw new MoklyError(
        "review-invalid",
        "Compiled comparison input is unavailable",
      );
    const git =
      this.git ??
      baselineReaderForCommit(
        this.config,
        source.baseCommit,
        new ConfiguredGitCommandRunner(this.config, signal),
        signal,
      );
    const before = new SelectedAssetReader(
      new GitReviewAssetReader(
        baselineResourceConfig(this.config, source.before),
        git,
        source.baseCommit,
        toPosixPath(
          path.relative(this.config.repoRoot, this.config.mockupsDir),
        ),
      ),
      signal,
    );
    const after = new SelectedAssetReader(
      new CompiledReviewAssetReader(
        this.config,
        source.headOutputs ? new Map(source.headOutputs) : undefined,
      ),
      signal,
      source.headDigests,
    );
    const result = source.result
      ? selectedComponentResult(source.result, selection)
      : await this.screenResult(source, selection, before, after);
    parseReviewResult(result);
    const files = new Map<string, ReviewArtifactContent>();
    for (const side of ["before", "after"] as const) {
      const artifacts = selectedArtifacts(
        side === "before" ? source.before : source.after,
        selection.id,
      );
      const routes = new Set(artifacts.map((artifact) => artifact.source));
      if (side === "after")
        for (const route of routes)
          if (!Object.hasOwn(source.headDigests, route))
            throw new MoklyError(
              "review-invalid",
              `Selected document has not been checked: ${route}`,
            );
      const reader = side === "before" ? before : after;
      await copySnapshotDependencies(
        files,
        side,
        routes,
        (route) => reader.read(route),
        (routes) => reader.readMany(routes),
      );
      for (const artifact of artifacts) {
        const sourcePath = `snapshots/${side}/${artifact.source}`;
        const targetPath = `snapshots/${side}/${artifact.target}`;
        if (sourcePath === targetPath) continue;
        const content = files.get(sourcePath);
        if (content === undefined)
          throw new MoklyError(
            "review-invalid",
            `Selected snapshot is missing: ${artifact.source}`,
          );
        files.delete(sourcePath);
        files.set(
          targetPath,
          relocateHistoricalDocument(
            Buffer.from(content).toString("utf8"),
            artifact.source,
            artifact.target,
          ),
        );
      }
    }
    signal.throwIfAborted();
    return { result, files };
  }

  private async screenResult(
    source: SelectedReviewSource,
    selection: ReviewSelection,
    beforeReader: SelectedAssetReader,
    afterReader: SelectedAssetReader,
  ): Promise<ReviewResult> {
    const before = source.before.entries.find(
      (entry): entry is HistoricalManifestScreen =>
        entry.kind === "screen" &&
        "artifacts" in entry &&
        entry.id === selection.id,
    );
    const after = source.after.entries.find(
      (entry): entry is ManifestScreen =>
        entry.kind === "screen" &&
        !("artifacts" in entry) &&
        entry.id === selection.id,
    );
    if (!before && !after) throw missingSelection();
    const sharedImpact = source.changedPaths.filter((changed) =>
      this.config.review.sharedImpact.some((glob) =>
        minimatch(changed, glob, { dot: true }),
      ),
    );
    const baseDocuments = await beforeReader.readMany(
      before ? fragmentRoutes(before) : [],
    );
    const headDocuments = await afterReader.readMany(
      after ? fragmentRoutes(after) : [],
    );
    const outputs = new Map(
      [...headDocuments].map(([route, bytes]) => [
        route,
        Buffer.from(bytes).toString("utf8"),
      ]),
    );
    const screen = await compareScreen(
      before,
      after,
      baseDocuments,
      { outputs },
      source.changedPaths,
      sharedImpact,
      new Map(),
      new Set(),
      new Set(),
      new ResourceComparison(
        new ComponentMaterialReader(beforeReader),
        new ComponentMaterialReader(afterReader),
        new Set(source.changedPaths),
        toPosixPath(
          path.relative(this.config.repoRoot, this.config.mockupsDir),
        ),
      ),
      this.config,
    );
    const reviewed = {
      ...screen,
      ...(before ? { before: { id: before.id, title: before.title } } : {}),
      ...(after ? { after: { id: after.id, title: after.title } } : {}),
    };
    return {
      affectedConsumers: [],
      baseCommit: source.baseCommit,
      baseRef: source.baseRef,
      changedPaths: source.changedPaths,
      changes: [],
      components: [],
      ignoredImpact: aggregateIgnored([reviewed]),
      schemaVersion: 4,
      screens: [reviewed],
      sharedImpact,
    };
  }
}

function selectedArtifacts(manifest: Manifest, id: string) {
  const entry = manifest.entries.find(
    (candidate) =>
      candidate.id === id &&
      (candidate.kind === "screen" ||
        (candidate.kind === "component" &&
          isManifestComponentVariant(candidate))),
  );
  if (!entry || (entry.kind !== "screen" && entry.kind !== "component"))
    return [];
  return generatedViews(entry).map((view) => ({
    source: view.path,
    target: viewRoute(entry.kind, entry.id, view.viewport, view.colorScheme),
  }));
}
