/** Capture one selection from the accepted catalogue without another exhaustive build. */
import path from "node:path";

import type { InsertedComponentStylesheet } from "@mokly/viewer";
import {
  isManifestComponentVariant,
  parseReviewResult,
  snapshotViewPath,
} from "@mokly/viewer/data";
import type {
  Manifest,
  ReviewArtifact,
  ReviewArtifactContent,
} from "@mokly/viewer/data";

import {
  receiveGeneratedFile,
  type GeneratedFile,
} from "../build/generated_file.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { addArtifactFile } from "./artifact_files.js";
import type { StylesheetReviewArtifact } from "./artifact_stylesheets.js";
import { GitReviewAssetReader } from "./assets.js";
import { baselineResourceConfig } from "./base_manifest.js";
import { SelectedAssetReader } from "./evidence_assets.js";
import type { BaselineReader } from "./git.js";
import { CompiledReviewAssetReader } from "./head_assets.js";
import { comparisonNotPrepared } from "./repository.js";
import { selectedComponentResult } from "./selection_result.js";
import type {
  ReviewSelection,
  SelectedReviewProvider,
  SelectedReviewSource,
} from "./selection_types.js";
import { copySnapshotDependencies } from "./snapshot_resources.js";
import { reviewViews } from "./views.js";

export class RepositorySelectedReview implements SelectedReviewProvider {
  constructor(
    private readonly config: ResolvedConfig,
    private readonly git?: BaselineReader | (() => BaselineReader),
  ) {}

  async generate(
    source: SelectedReviewSource,
    selection: ReviewSelection,
    signal: AbortSignal,
  ): Promise<ReviewArtifact> {
    if (!source.headOutputs)
      throw new MoklyError(
        "review-invalid",
        "Compiled comparison input is unavailable",
      );
    if (!this.git) throw comparisonNotPrepared();
    const git = typeof this.git === "function" ? this.git() : this.git;
    const before = new SelectedAssetReader(
      new GitReviewAssetReader(
        baselineResourceConfig(this.config, source.before),
        git,
        source.baseCommit,
        toPosixPath(
          path.relative(this.config.repoRoot, this.config.mockupsDir),
        ),
        source.before,
      ),
      signal,
    );
    const after = new SelectedAssetReader(
      new CompiledReviewAssetReader(
        this.config,
        source.headOutputs
          ? new Map<string, GeneratedFile>(
              source.headOutputs.map(([route, content]) => {
                const decoded = receiveGeneratedFile(content);
                if (decoded === undefined)
                  throw new MoklyError(
                    "review-invalid",
                    `Invalid generated comparison resource: ${route}`,
                  );
                return [route, decoded];
              }),
            )
          : undefined,
      ),
      signal,
      source.headDigests,
    );
    if (!source.result)
      throw new MoklyError(
        "review-invalid",
        "The catalogue comparison is not ready",
      );
    const result = selectedComponentResult(source.result, selection);
    parseReviewResult(result);
    const entry = result.screens[0] ?? result.components[0]?.variants[0];
    const files = new Map<string, ReviewArtifactContent>();
    const insertedStylesheets = new Map<
      string,
      readonly InsertedComponentStylesheet[]
    >();
    for (const side of ["before", "after"] as const) {
      const path = entry?.[side]?.path;
      const artifacts = path
        ? selectedArtifacts(
            side === "before" ? source.before : source.after,
            path,
            side,
          )
        : [];
      const routes = new Set(artifacts.map(({ route }) => route));
      if (side === "after")
        for (const route of routes)
          if (!Object.hasOwn(source.headDigests, route))
            throw new MoklyError(
              "review-invalid",
              `Selected document has not been checked: ${route}`,
            );
      const reader = side === "before" ? before : after;
      const loaded = await reader.readMany([...routes]);
      for (const artifact of artifacts) {
        const content = loaded.get(artifact.route);
        if (content === undefined)
          throw new MoklyError(
            "review-invalid",
            `Selected document is unavailable: ${artifact.route}`,
          );
        addArtifactFile(files, artifact.snapshot, content);
        insertedStylesheets.set(
          artifact.snapshot,
          artifact.insertedStylesheets,
        );
      }
      await copySnapshotDependencies(
        files,
        side,
        routes,
        (route) => reader.read(route),
        (routes) => reader.readMany(routes),
      );
    }
    signal.throwIfAborted();
    const artifact: StylesheetReviewArtifact = {
      result,
      files,
      insertedStylesheets,
    };
    return artifact;
  }
}

function selectedArtifacts(
  manifest: Manifest,
  id: string,
  side: "after" | "before",
) {
  const entry = manifest.entries.find(
    (candidate) =>
      candidate.path === id &&
      (candidate.kind === "screen" ||
        (candidate.kind === "component" &&
          isManifestComponentVariant(candidate))),
  );
  if (!entry || (entry.kind !== "screen" && entry.kind !== "component"))
    return [];
  return reviewViews(entry).map((view) => ({
    route: view.path,
    insertedStylesheets: view.usage?.insertedStylesheets ?? [],
    snapshot: snapshotViewPath(
      side,
      entry.path,
      view.viewport,
      view.colorScheme,
    ),
  }));
}
