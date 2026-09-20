/** Capture one removed page and its transitive historical resource closure. */
import path from "node:path";

import { canonicalJson, parseRemovedPagePreview } from "@mokly/viewer/data";
import type {
  RemovedPagePreviewArtifact,
  ReviewArtifactContent,
} from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { copySnapshotDependencies, GitReviewAssetReader } from "./assets.js";
import { baselineResourceConfig } from "./base_manifest.js";
import { SelectedAssetReader } from "./evidence_assets.js";
import type { BaselineReader } from "./git.js";
import { addArtifactFile, snapshotPath } from "./paths.js";
import { missingSelection } from "./selection_result.js";
import type {
  RemovedPagePreviewProvider,
  RemovedPagePreviewSource,
  RemovedPageSelection,
} from "./selection_types.js";

/** Git-backed capture over a baseline reader pinned by the caller. */
export class RepositoryRemovedPagePreview implements RemovedPagePreviewProvider {
  constructor(
    private readonly config: ResolvedConfig,
    private readonly baseline: BaselineReader,
  ) {}

  async generate(
    source: RemovedPagePreviewSource,
    selection: RemovedPageSelection,
    signal: AbortSignal,
  ): Promise<RemovedPagePreviewArtifact> {
    const removed = source.removedEntries.find(
      ({ entry }) => entry.kind === "page" && entry.route === selection.route,
    );
    if (!removed || selection.kind !== "page") throw missingSelection();
    const historical = source.baseline.entries.find(
      (entry) =>
        entry.kind === "page" &&
        entry.id === removed.entry.id &&
        entry.route === removed.entry.route,
    );
    if (
      !historical ||
      canonicalJson(historical) !== canonicalJson(removed.entry)
    )
      throw new MoklyError(
        "review-invalid",
        "The selected removed page does not match the pinned baseline",
      );
    const reader = new SelectedAssetReader(
      new GitReviewAssetReader(
        baselineResourceConfig(this.config, source.baseline),
        this.baseline,
        source.baseCommit,
        toPosixPath(
          path.relative(this.config.repoRoot, this.config.mockupsDir),
        ),
      ),
      signal,
    );
    const files = new Map<string, ReviewArtifactContent>();
    await copySnapshotDependencies(
      files,
      "before",
      new Set([removed.entry.route]),
      (route) => reader.read(route),
      (routes) => reader.readMany(routes),
    );
    signal.throwIfAborted();
    const preview = parseRemovedPagePreview({
      schemaVersion: 1,
      baseRef: source.baseRef,
      baseCommit: source.baseCommit,
      route: removed.entry.route,
      documentPath: snapshotPath("before", removed.entry.route),
    });
    return { files, preview };
  }
}

/** Serialize typed page metadata beside its already-confined snapshot files. */
export function renderRemovedPagePreviewArtifact(
  artifact: RemovedPagePreviewArtifact,
): ReadonlyMap<string, ReviewArtifactContent> {
  const files = new Map(artifact.files);
  const preview = parseRemovedPagePreview(artifact.preview);
  addArtifactFile(files, "preview.json", `${canonicalJson(preview, 2)}\n`);
  return files;
}

/** Capture every removed page in one accepted catalogue-change snapshot. */
export async function captureRemovedPagePreviews(
  provider: RemovedPagePreviewProvider,
  source: RemovedPagePreviewSource,
  signal: AbortSignal,
): Promise<ReadonlyMap<string, RemovedPagePreviewArtifact>> {
  const artifacts = new Map<string, RemovedPagePreviewArtifact>();
  const routes = source.removedEntries
    .flatMap(({ entry }) => (entry.kind === "page" ? [entry.route] : []))
    .sort();
  for (const route of routes) {
    signal.throwIfAborted();
    if (artifacts.has(route))
      throw new MoklyError(
        "review-invalid",
        `Duplicate removed page preview route: ${route}`,
      );
    const artifact = await provider.generate(
      source,
      { kind: "page", route },
      signal,
    );
    if (
      artifact.preview.route !== route ||
      artifact.preview.baseCommit !== source.baseCommit ||
      artifact.preview.baseRef !== source.baseRef
    )
      throw new MoklyError(
        "review-invalid",
        `Removed page preview does not match its accepted source: ${route}`,
      );
    artifacts.set(route, artifact);
  }
  signal.throwIfAborted();
  return artifacts;
}

/** Add packaged page metadata and shared snapshots to one comparison generation. */
export function packageRemovedPagePreviews(
  files: ReadonlyMap<string, ReviewArtifactContent>,
  artifacts: ReadonlyMap<string, RemovedPagePreviewArtifact>,
): ReadonlyMap<string, ReviewArtifactContent> {
  const packaged = new Map(files);
  for (const [route, artifact] of artifacts) {
    if (artifact.preview.route !== route)
      throw new MoklyError(
        "review-invalid",
        `Removed page preview route does not match its selection: ${route}`,
      );
    for (const [name, content] of renderRemovedPagePreviewArtifact(artifact)) {
      const target = name === "preview.json" ? `pages/${route}.json` : name;
      const previous = packaged.get(target);
      if (previous === undefined) packaged.set(target, content);
      else if (!Buffer.from(previous).equals(Buffer.from(content)))
        throw new MoklyError(
          "review-invalid",
          `Removed page preview conflicts with generation file: ${target}`,
        );
    }
  }
  return packaged;
}
