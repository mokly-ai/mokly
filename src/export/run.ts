import type { ReviewArtifact } from "@mokly/viewer/data";

import { compileCatalogue } from "../build/compile.js";
import { writeCompilation } from "../build/transaction.js";
import { projectRealPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import { readBaseManifest } from "../review/base_manifest.js";
import { reviewChangedPaths } from "../review/changed_paths.js";
import { compareReview } from "../review/compare.js";
import { prepareReviewRepository } from "../review/prepare.js";
import { changedContentPaths } from "../server/changed_content.js";

import { withExportCleanup } from "./cleanup.js";
import { assertExportActive, exportError } from "./error.js";
import {
  assertInputsUnchanged,
  capturedAssetReader,
  pinnedEvidence,
} from "./inputs.js";
import { resolveExportOutput } from "./paths.js";
import { capturePublicFiles } from "./public_files.js";
import { assembleExport } from "./site.js";
import { stageExport } from "./stage.js";
import { ExportTransaction } from "./transaction.js";
import type { ExportOptions, ExportResult, ExportRoutes } from "./types.js";

/** Build and transactionally export a consumer's complete static catalogue. */
export async function exportCatalogue(
  config: ResolvedConfig,
  options: ExportOptions,
): Promise<ExportResult> {
  const outputRoot = options.adapter?.outputRoot;
  const output = resolveExportOutput(config, options.outDir, outputRoot);
  assertExportActive(options.signal);
  const transaction = await ExportTransaction.open(
    output,
    options.adapter?.legacyOwnership,
  );
  return withExportCleanup(
    () => generateExport(config, options, output, transaction, outputRoot),
    () => transaction.close(),
  );
}

async function generateExport(
  config: ResolvedConfig,
  options: ExportOptions,
  output: string,
  transaction: ExportTransaction,
  outputRoot?: string,
): Promise<ExportResult> {
  try {
    const base = options.base ?? config.review.base;
    const prepared = options.noChanges
      ? undefined
      : await prepareReviewRepository(
          config,
          base,
          options.signal ? { signal: options.signal } : {},
        );
    const baseline = prepared
      ? await readBaseManifest(prepared.reader, prepared.commit, config)
      : undefined;
    const compilation = await compileCatalogue(config);
    config = { ...config, sourceFiles: compilation.manifest.sourceFiles };
    assertExportActive(options.signal);
    await writeCompilation(compilation, config);
    const publicFiles = await capturePublicFiles(
      config,
      config.generatedOutput === "derived" ? compilation.outputs : undefined,
    );
    const assetReader = capturedAssetReader(publicFiles, config);
    const exclusions = [output, transaction.reservationRoot];
    const changed = prepared
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
      comparison = await compareReview(
        compilation,
        config,
        {
          evidence: pinnedEvidence(prepared.commit, changed),
          reader: prepared.reader,
        },
        base,
        transaction.stage,
        assetReader,
        exclusions,
      );
      contentChanges = await changedContentPaths(
        compilation.manifest,
        baseline,
        config,
        prepared.reader,
        prepared.commit,
        changed,
        assetReader,
        comparison.result.schemaVersion === 3 ? "pages" : "all",
      );
    }
    const site = assembleExport(
      config,
      compilation,
      baseline ?? compilation.manifest,
      comparison,
      publicFiles,
      contentChanges,
    );
    if (!options.noChanges && site.delivery.comparisonUrl === null)
      throw exportError("Consumer export comparison metadata is missing.");
    const routes: ExportRoutes = Object.freeze({
      outDir: output,
      comparisonUrl: site.delivery.comparisonUrl,
      idRoutes: Object.freeze({ ...site.delivery.idRoutes }),
    });
    const aliases = new Map(
      (await options.adapter?.transform(site.inventory.files, routes)) ?? [],
    );
    const deploymentId = await stageExport(
      transaction.stage,
      site.inventory.files,
      site.shells,
      aliases,
      options.signal,
      options.capture,
    );
    await assertInputsUnchanged(
      config,
      compilation,
      publicFiles,
      prepared,
      changed,
      exclusions,
    );
    assertExportActive(options.signal);
    if (
      projectRealPath(resolveExportOutput(config, output, outputRoot)) !==
      transaction.output
    )
      throw exportError(
        "Export output changed its real location during export.",
      );
    await transaction.install(options.signal);
    return { ...routes, deploymentId };
  } catch (error) {
    if (error instanceof MoklyError) throw error;
    throw exportError(
      `Could not export catalogue: ${errorMessage(error)}`,
      error,
    );
  }
}
