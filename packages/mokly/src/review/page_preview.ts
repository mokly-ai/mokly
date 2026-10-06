/** Capture one removed page and its transitive historical resource closure. */
import path from "node:path";

import {
  canonicalJson,
  documentRoute,
  previewMetadataPath,
  parseRemovedPagePreview,
  snapshotDocumentPath,
} from "@mokly/viewer/data";
import type {
  HistoricalManifestPage,
  ManifestDocument,
  RemovedPagePreview,
  RemovedPagePreviewArtifact,
  ReviewArtifactContent,
} from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import {
  documentResourceIndex,
  linkedDocumentResources,
} from "../documents/resource_references.js";
import { MoklyError } from "../errors.js";

import { addArtifactFile } from "./artifact_files.js";
import { copySnapshotDependencies, GitReviewAssetReader } from "./assets.js";
import { baselineResourceConfig } from "./base_manifest.js";
import { SelectedAssetReader } from "./evidence_assets.js";
import type { BaselineReader } from "./git.js";
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
      ({ entry }) =>
        (entry.kind === "page" || entry.kind === "document") &&
        entry.path === selection.path,
    );
    if (!removed || selection.kind !== "page") throw missingSelection();
    const historical = source.baseline.entries.find(
      (entry): entry is HistoricalManifestPage | ManifestDocument =>
        entry.kind === removed.entry.kind && entry.path === removed.entry.path,
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
    const schemes =
      historical.kind === "document"
        ? historical.colorSchemes
        : (["light"] as const);
    const documents = new Set<string>();
    const resources = documentResourceIndex([historical]);
    for (const scheme of schemes) {
      const document = documentRoute(historical.path, scheme);
      documents.add(document);
      const content = await reader.read(document);
      for (const resource of linkedDocumentResources(
        document,
        Buffer.from(content).toString("utf8"),
        resources,
      ))
        documents.add(resource);
      addArtifactFile(
        files,
        snapshotDocumentPath("before", historical.path, scheme),
        content,
      );
    }
    await copySnapshotDependencies(
      files,
      "before",
      documents,
      (route) => reader.read(route),
      (routes) => reader.readMany(routes),
    );
    signal.throwIfAborted();
    const preview = parseRemovedPagePreview({
      schemaVersion: 3,
      baseRef: source.baseRef,
      baseCommit: source.baseCommit,
      path: removed.entry.path,
    } satisfies RemovedPagePreview);
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
  const ids = source.removedEntries
    .flatMap(({ entry }) =>
      entry.kind === "page" || entry.kind === "document" ? [entry.path] : [],
    )
    .sort();
  for (const id of ids) {
    signal.throwIfAborted();
    if (artifacts.has(id))
      throw new MoklyError(
        "review-invalid",
        `Duplicate removed page preview id: ${id}`,
      );
    const artifact = await provider.generate(
      source,
      { kind: "page", path: id },
      signal,
    );
    if (
      artifact.preview.path !== id ||
      artifact.preview.baseCommit !== source.baseCommit ||
      artifact.preview.baseRef !== source.baseRef
    )
      throw new MoklyError(
        "review-invalid",
        `Removed page preview does not match its accepted source: ${id}`,
      );
    artifacts.set(id, artifact);
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
  for (const [id, artifact] of artifacts) {
    if (artifact.preview.path !== id)
      throw new MoklyError(
        "review-invalid",
        `Removed page preview id does not match its selection: ${id}`,
      );
    for (const [name, content] of renderRemovedPagePreviewArtifact(artifact)) {
      const target = name === "preview.json" ? previewMetadataPath(id) : name;
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
