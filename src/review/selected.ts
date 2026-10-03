/** Capture one selection from the accepted catalogue without another exhaustive build. */
import path from "node:path";

import {
  generatedViews,
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
import { ConfiguredGitCommandRunner } from "../config/git.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { addArtifactFile } from "./artifact_files.js";
import { copySnapshotDependencies, GitReviewAssetReader } from "./assets.js";
import { baselineResourceConfig } from "./base_manifest.js";
import { SelectedAssetReader } from "./evidence_assets.js";
import type { BaselineReader } from "./git.js";
import { CompiledReviewAssetReader } from "./head_assets.js";
import { baselineReaderForCommit } from "./repository.js";
import { selectedComponentResult } from "./selection_result.js";
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
    const files = new Map<string, ReviewArtifactContent>();
    for (const side of ["before", "after"] as const) {
      const artifacts = selectedArtifacts(
        side === "before" ? source.before : source.after,
        selection.path,
        side,
      );
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
    return { result, files };
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
  return generatedViews(entry).map((view) => ({
    route: view.path,
    snapshot: snapshotViewPath(
      side,
      entry.path,
      view.viewport,
      view.colorScheme,
    ),
  }));
}
