import path from "node:path";

import type { ReviewArtifact } from "@mokly/viewer/data";

import { compileCatalogue } from "../build/compile.js";
import { projectRealPath, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { errorMessage, isCancellation, isMoklyError } from "../errors.js";
import { removedManifestEntries } from "../registry/changes.js";
import {
  parseHistoricalManifest,
  parseManifest,
} from "../registry/manifest.js";
import { hasRegisteredComponents } from "../registry/manifest_capabilities.js";
import { GitReviewAssetReader } from "../review/assets.js";
import { baselineResourceConfig } from "../review/base_manifest.js";
import { reviewChangedPaths } from "../review/changed_paths.js";
import { compareReview } from "../review/compare.js";
import { importedChangedPaths } from "../review/imported_changes.js";
import {
  captureRemovedPagePreviews,
  packageRemovedPagePreviews,
  RepositoryRemovedPagePreview,
} from "../review/page_preview.js";
import { changedContentPaths } from "../server/changed_content.js";

import { prepareExportBaseline } from "./baseline.js";
import { withExportCleanup } from "./cleanup.js";
import {
  assertExportActive,
  exportError,
  withPreInstallationCancellation,
} from "./error.js";
import {
  assertInputsUnchanged,
  capturedAssetReader,
  pinnedEvidence,
} from "./inputs.js";
import { resolveExportOutput } from "./paths.js";
import { capturePublicFiles } from "./public_files.js";
import { publicationMetadataPaths } from "./publication_metadata.js";
import { assembleExport } from "./site.js";
import { stageExport } from "./stage.js";
import { ExportTransaction } from "./transaction.js";
import type { ExportOptions, ExportResult, ExportRoutes } from "./types.js";

/** Injectable exhaustive compilation boundary. */
export interface ExportDependencies {
  readonly compile: typeof compileCatalogue;
}

/** Build and transactionally export a consumer's complete static catalogue. */
export async function exportCatalogue(
  config: ResolvedConfig,
  options: ExportOptions,
  provided: Partial<ExportDependencies> = {},
): Promise<ExportResult> {
  const outputRoot = options.adapter?.outputRoot;
  const output = resolveExportOutput(config, options.outDir, outputRoot);
  assertExportActive(options.signal);
  const transaction = await ExportTransaction.open(output);
  return withExportCleanup(
    () =>
      generateExport(
        config,
        options,
        output,
        transaction,
        provided.compile ?? compileCatalogue,
        outputRoot,
      ),
    () => transaction.close(),
  );
}

async function generateExport(
  config: ResolvedConfig,
  options: ExportOptions,
  output: string,
  transaction: ExportTransaction,
  compile: typeof compileCatalogue,
  outputRoot?: string,
): Promise<ExportResult> {
  try {
    const base = options.base ?? config.review.base;
    const { baseline, incompatible, prepared } =
      await withPreInstallationCancellation(options.signal, () =>
        prepareExportBaseline(config, options, base),
      );
    const compilation = await withPreInstallationCancellation(
      options.signal,
      () => compile(config, undefined, options.signal),
    );
    assertExportActive(options.signal);
    options.onBuildDiagnostics?.(compilation.diagnostics);
    config = { ...config, sourceFiles: compilation.manifest.sourceFiles };
    assertExportActive(options.signal);
    const publicFiles = await capturePublicFiles(
      config,
      compilation.outputs,
      parseManifest(compilation.manifest).assetClosure,
    );
    const result = await withPreInstallationCancellation(
      options.signal,
      async () => {
        const assetReader = capturedAssetReader(publicFiles, config);
        const exclusions = [output, transaction.reservationRoot];
        const changed =
          prepared && baseline
            ? await reviewChangedPaths(
                prepared.evidence,
                prepared.commit,
                config,
                config.review.outDir,
                exclusions,
              )
            : [];
        let comparison: ReviewArtifact | undefined;
        let contentChanges: readonly string[] = [];
        if (prepared && baseline) {
          const prefix = toPosixPath(
            path.relative(config.repoRoot, config.mockupsDir),
          );
          const baselineAssets = new GitReviewAssetReader(
            baselineResourceConfig(config, baseline),
            prepared.reader,
            prepared.commit,
            prefix,
            baseline,
          );
          const changeEvidence = await importedChangedPaths(
            config,
            baselineAssets,
            assetReader,
            changed,
            compilation.outputs,
            compilation.deliveredStyleSources,
          );
          comparison = await compareReview(
            compilation,
            config,
            {
              evidence: pinnedEvidence(prepared.commit, changed),
              reader: prepared.reader,
              ...(prepared.sourceReader
                ? { sourceReader: prepared.sourceReader }
                : {}),
            },
            base,
            transaction.stage,
            assetReader,
            exclusions,
            { changeEvidence },
          );
          for (const diagnostic of comparison.pairing?.diagnostics ?? [])
            options.diagnostic?.(diagnostic);
          contentChanges = await changedContentPaths(
            compilation.manifest,
            baseline,
            config,
            prepared.reader,
            prepared.commit,
            changeEvidence,
            assetReader,
            hasRegisteredComponents(compilation.manifest) ? "pages" : "all",
            { ...(comparison.pairing ? { pairing: comparison.pairing } : {}) },
          );
          const removedEntries = removedManifestEntries(
            compilation.manifest,
            baseline,
            comparison.pairing?.moves,
          );
          const pagePreviews = await captureRemovedPagePreviews(
            new RepositoryRemovedPagePreview(config, prepared.reader),
            {
              schemaVersion: 3,
              movedEntries:
                comparison.pairing?.moves.map(({ path, previousPath }) => ({
                  path,
                  previousPath,
                })) ?? [],
              baseline,
              baseCommit: comparison.result.baseCommit,
              baseRef: comparison.result.baseRef,
              changedEntries: removedEntries.map(({ entry }) => entry.path),
              removedEntries,
            },
            options.signal ?? new AbortController().signal,
          );
          comparison = {
            ...comparison,
            files: packageRemovedPagePreviews(comparison.files, pagePreviews),
          };
        }
        const site = assembleExport(
          config,
          compilation,
          baseline ?? parseHistoricalManifest(compilation.manifest),
          comparison,
          publicFiles,
          contentChanges,
          options.noChanges
            ? "disabled"
            : incompatible
              ? "unavailable"
              : "ready",
        );
        if (
          !options.noChanges &&
          !incompatible &&
          site.delivery.comparisonUrl === null
        )
          throw exportError("Consumer export comparison metadata is missing.");
        const routes: ExportRoutes = Object.freeze({
          outDir: output,
          comparisonUrl: site.delivery.comparisonUrl,
        });
        const pathsBeforeAdapter = new Set(site.inventory.files.keys());
        const aliases = new Map(
          (await options.adapter?.transform(site.inventory.files, routes)) ??
            [],
        );
        const publicationMetadata = publicationMetadataPaths(
          options.adapter?.publicationMetadata,
          pathsBeforeAdapter,
          site.inventory.files,
          site.shells,
        );
        const deploymentId = await stageExport(
          transaction.stage,
          site.inventory.files,
          site.shells,
          aliases,
          options.signal,
          options.capture,
          publicationMetadata,
        );
        await assertInputsUnchanged(
          config,
          compilation,
          publicFiles,
          prepared,
          changed,
          exclusions,
          baseline !== undefined,
          options.signal,
        );
        assertExportActive(options.signal);
        if (
          projectRealPath(resolveExportOutput(config, output, outputRoot)) !==
          transaction.output
        )
          throw exportError(
            "Export output changed its real location during export.",
          );
        return { ...routes, deploymentId };
      },
    );
    await transaction.install(options.signal);
    return result;
  } catch (error) {
    if (isMoklyError(error)) throw error;
    throw exportError(
      `Could not export catalogue: ${errorMessage(error)}`,
      error,
      { cancelled: isCancellation(error) },
    );
  }
}
