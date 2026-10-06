import {
  generatedViews,
  isManifestComponentVariant,
  snapshotViewPath,
} from "@mokly/viewer/data";
import type {
  Manifest,
  ReviewArtifact,
  ReviewArtifactContent,
} from "@mokly/viewer/data";

import type { Compilation } from "../build/compile.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";

import { addArtifactFile } from "./artifact_files.js";
import {
  copySnapshotDependencies,
  type GitReviewAssetReader,
  type ReviewAssetReader,
} from "./assets.js";
import type { CompareReviewOptions } from "./compare.js";
import { CompilationAssetReader } from "./compilation_assets.js";
import { classifyComponents } from "./component_classification.js";
import { baselineForCurrentIdentities } from "./component_metadata.js";
import type { BaselineReader } from "./git.js";
import type { MarkdownMoveSources } from "./moves/markdown_sources.js";
import { prepareMoveClassification } from "./moves/prepare.js";

/** Retain every component variant and affected screen, then classify the same immutable bytes. */
export async function compareComponentCatalogue(
  compilation: Compilation,
  baseline: Manifest,
  config: ResolvedConfig,
  baseReader: GitReviewAssetReader,
  headReader: ReviewAssetReader,
  changedPaths: readonly string[],
  baseCommit: string,
  baseRef: string,
  options: CompareReviewOptions = {},
  markdown?: MarkdownMoveSources,
  sourceReader?: BaselineReader,
): Promise<ReviewArtifact> {
  const baseArtifacts = artifactViews(baseline);
  const headArtifacts = artifactViews(compilation.manifest);
  const basePaths = baseArtifacts.map(({ route }) => route);
  const headPaths = headArtifacts.map(({ route }) => route);
  const baseFiles = await timeAsync("review.base-documents", () =>
    baseReader.readMany(basePaths),
  );
  const beforeReader: ReviewAssetReader = {
    readManyIfExists: (routes) => baseReader.readManyIfExists(routes),
    read: async (route) => baseFiles.get(route) ?? baseReader.read(route),
    readMany: async (routes) => {
      const missing = routes.filter((route) => !baseFiles.has(route));
      const loaded = missing.length
        ? await baseReader.readMany(missing)
        : new Map<string, Uint8Array>();
      return new Map(
        routes.map((route) => [
          route,
          baseFiles.get(route) ?? loaded.get(route)!,
        ]),
      );
    },
  };
  const afterReader = new CompilationAssetReader(
    compilation.outputs,
    headReader,
  );
  const prepared = await prepareMoveClassification({
    before: baseline,
    after: compilation.manifest,
    beforeReader,
    afterReader,
    config,
    changedPaths,
    baseCommit,
    baseRef,
    ...options,
    ...(markdown ? { markdown } : {}),
    ...(sourceReader ? { sourceReader } : {}),
  });
  const result = await classifyComponents(prepared);
  baseline = baselineForCurrentIdentities(
    baseline,
    compilation.manifest,
    prepared.pairing.moves,
  );
  const retainedBaseArtifacts = artifactViews(baseline);
  const files = new Map<string, ReviewArtifactContent>();
  for (const artifact of retainedBaseArtifacts)
    addArtifactFile(
      files,
      artifact.snapshot.before,
      Buffer.from(await beforeReader.read(artifact.route)).toString("utf8"),
    );
  for (const artifact of headArtifacts)
    addArtifactFile(
      files,
      artifact.snapshot.after,
      Buffer.from(await afterReader.read(artifact.route)).toString("utf8"),
    );
  await copySnapshotDependencies(
    files,
    "before",
    new Set(retainedBaseArtifacts.map((artifact) => artifact.route)),
    (route) => beforeReader.read(route),
    (routes) => baseReader.readMany(routes),
  );
  await copySnapshotDependencies(files, "after", new Set(headPaths), (route) =>
    afterReader.read(route),
  );
  return {
    result,
    files,
    ...(prepared.pairing.moves.length || prepared.pairing.diagnostics.length
      ? { pairing: prepared.pairing }
      : {}),
  };
}

function artifactViews(manifest: Manifest) {
  return manifest.entries.flatMap((entry) => {
    if (
      entry.kind !== "screen" &&
      !(entry.kind === "component" && isManifestComponentVariant(entry))
    )
      return [];
    return generatedViews(entry).map((view) => ({
      route: view.path,
      snapshot: {
        after: snapshotViewPath(
          "after",
          entry.path,
          view.viewport,
          view.colorScheme,
        ),
        before: snapshotViewPath(
          "before",
          entry.path,
          view.viewport,
          view.colorScheme,
        ),
      },
    }));
  });
}
