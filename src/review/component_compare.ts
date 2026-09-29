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
import { CompilationAssetReader } from "./compilation_assets.js";
import { classifyComponents } from "./component_classification.js";
import { baselineForCurrentIdentities } from "./component_metadata.js";

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
  useFastPath?: boolean,
): Promise<ReviewArtifact> {
  baseline = baselineForCurrentIdentities(baseline, compilation.manifest);
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
  const result = await classifyComponents({
    before: baseline,
    after: compilation.manifest,
    beforeReader,
    afterReader,
    config,
    changedPaths,
    baseCommit,
    baseRef,
    ...(useFastPath === undefined ? {} : { useFastPath }),
  });
  const files = new Map<string, ReviewArtifactContent>();
  for (const artifact of baseArtifacts)
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
    new Set(basePaths),
    (route) => beforeReader.read(route),
    (routes) => baseReader.readMany(routes),
  );
  await copySnapshotDependencies(files, "after", new Set(headPaths), (route) =>
    afterReader.read(route),
  );
  return { result, files };
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
          entry.kind,
          entry.id,
          view.viewport,
          view.colorScheme,
        ),
        before: snapshotViewPath(
          "before",
          entry.kind,
          entry.id,
          view.viewport,
          view.colorScheme,
        ),
      },
    }));
  });
}
