/** Capture one selection from the accepted catalogue without another exhaustive build. */
import path from "node:path";

import { minimatch } from "minimatch";

import { parseReviewResult } from "@mokly/viewer/data";
import type {
  ManifestScreen,
  ReviewArtifact,
  ReviewArtifactContent,
  ReviewResult,
  ViewReview,
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
    const views =
      result.schemaVersion === 3 && result.components.length
        ? result.components.flatMap((entry) =>
            entry.variants.flatMap((variant) => variant.views),
          )
        : result.screens.flatMap((screen) => screen.views);
    const files = new Map<string, ReviewArtifactContent>();
    for (const side of ["before", "after"] as const) {
      const routes = snapshotRoutes(views, side);
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
    if (selection.variantId !== undefined) throw missingSelection();
    const before = source.before.entries.find(
      (entry): entry is ManifestScreen =>
        entry.kind === "screen" && entry.route === selection.route,
    );
    const after = source.after.entries.find(
      (entry): entry is ManifestScreen =>
        entry.kind === "screen" && entry.route === selection.route,
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
    return {
      baseCommit: source.baseCommit,
      baseRef: source.baseRef,
      changedPaths: source.changedPaths,
      ignoredImpact: aggregateIgnored([screen]),
      schemaVersion: 2,
      screens: [screen],
      sharedImpact,
    };
  }
}

function snapshotRoutes(
  views: readonly ViewReview[],
  side: "before" | "after",
): Set<string> {
  return new Set(
    views.flatMap((view) => {
      const route = view[`${side}Path`];
      return route ? [route.slice(`snapshots/${side}/`.length)] : [];
    }),
  );
}
