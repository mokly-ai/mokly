import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { compileCatalogue } from "../../dist/build/compile.js";
import { componentRuntime } from "../../dist/build/component_runtime.js";
import { generatedBytes } from "../../dist/build/generated_file.js";
import { projectCatalogue } from "../../dist/catalogue/projection.js";
import {
  CATALOGUE_PATH,
  serializeCatalogue,
} from "../../dist/catalogue/serialization.js";
import { isInside, projectRealPath } from "../../dist/config/paths.js";
import { errorMessage } from "../../dist/errors.js";
import { externalizeCapturedShell } from "../../dist/export/captured_shell.js";
import { withExportCleanup } from "../../dist/export/cleanup.js";
import { assertExportOwnership } from "../../dist/export/ownership.js";
import { resolveExportOutput } from "../../dist/export/paths.js";
import { ExportTransaction } from "../../dist/export/transaction.js";
import { publicationOptions } from "../../dist/publication/options.js";
import { copyPublicFiles } from "../../dist/publication/resources.js";
import { acceptedGenerationFromCompilation } from "../../dist/review/accepted_generation.js";
import { prepareReviewRepository } from "../../dist/review/prepare.js";
import { loadCatalogueSnapshot } from "../../dist/server/catalogue_snapshot.js";
import { computeCatalogueChanges } from "../../dist/server/changed.js";
import { startCatalogueServer } from "../../dist/server/http.js";

import { previewOwnership, stagePreviewArtifact } from "./artifact.mjs";
import { captureAssets, capturePage, writeText } from "./capture.mjs";
import { publicationChangeEvidence } from "./change_evidence.mjs";
import {
  captureComparison,
  capturePublicationPagePreviews,
  previewComparisonProvider,
  publishComparison,
} from "./comparisons.mjs";
import { capturePublicationInputs } from "./inputs.mjs";

/** Capture already-built output; the supported npm command builds before this boundary. */
export async function buildPreview(config, output, options = {}) {
  const ownership = previewOwnership(config);
  const capability = publicationOptions(options);
  assertSafeOutput(output, config.repoRoot);
  const contextRoot = path.join(config.repoRoot, ".context");
  const destination = resolveExportOutput(config, output, contextRoot);
  try {
    await assertExportOwnership(destination, ownership);
  } catch (cause) {
    throw new Error(
      `refusing to replace unowned preview directory: ${output}`,
      { cause },
    );
  }
  const transaction = await ExportTransaction.open(destination, ownership);
  try {
    await withExportCleanup(
      async () => {
        const stage = transaction.stage;
        const excludedRoots = [stage, output, transaction.reservationRoot];
        const base = capability.includeChanges
          ? (capability.base ?? config.review.base)
          : "";
        const prepared = capability.includeChanges
          ? await prepareReviewRepository(config, base)
          : undefined;
        const git = prepared;
        const inputs = await capturePublicationInputs(config, excludedRoots);
        const compiled =
          config.generatedOutput === "derived"
            ? await compileCatalogue(config)
            : undefined;
        if (compiled && !isDeepStrictEqual(compiled.manifest, inputs.manifest))
          throw new Error(
            "consumer inputs changed during publication; retry with stable inputs",
          );
        const changeEvidence = git
          ? await publicationChangeEvidence(
              config,
              git,
              compiled,
              excludedRoots,
            )
          : undefined;
        const snapshot = await loadCatalogueSnapshot(
          config,
          git
            ? (manifest, accepted) =>
                computeCatalogueChanges(
                  config,
                  base,
                  git,
                  manifest,
                  changeEvidence,
                  compiled
                    ? acceptedGenerationFromCompilation(compiled)
                    : accepted,
                )
            : undefined,
          compiled?.manifest ?? inputs.manifest,
        );
        const { catalogue, changes } = snapshot;
        const manifest = catalogue.manifest;
        const review = git
          ? previewComparisonProvider(config, stage, base, git, changeEvidence)
          : undefined;
        const server = await startCatalogueServer(config, {
          base,
          liveChanges: false,
          snapshot,
          port: 0,
          ...(compiled ? { componentRuntime: componentRuntime(compiled) } : {}),
          ...(review ? { review } : {}),
        });
        let comparison;
        let pagePreviews = new Map();
        let removed = [];
        const capturedShells = new Set();
        try {
          if (review) {
            comparison = await captureComparison(server.url);
            removed = changes.removedEntries.map(({ entry }) => entry);
            pagePreviews = await capturePublicationPagePreviews(
              config,
              prepared,
              changes,
            );
          }
          await capturePage(server.url, "/", stage, "index.html");
          capturedShells.add("index.html");
          for (const entry of [...manifest.entries, ...removed]) {
            if (entry.kind === "collection") continue;
            const name = `view/${entry.route}`;
            await capturePage(
              server.url,
              `/view/${encodePath(entry.route)}`,
              stage,
              name,
            );
            capturedShells.add(name);
          }
          await capturePage(
            server.url,
            "/preview-route-that-does-not-exist",
            stage,
            "404.html",
            404,
          );
          capturedShells.add("404.html");
          await captureAssets(server.url, stage);
        } finally {
          await server.close();
        }
        if (review && comparison)
          comparison = await publishComparison(
            review,
            comparison,
            stage,
            changes.removedEntries,
            pagePreviews,
          );
        await copyPublicFiles(
          config,
          catalogue,
          stage,
          excludedRoots,
          compiled?.outputs,
        );
        const readModel = projectCatalogue({
          configPath: path
            .relative(config.repoRoot, config.configPath)
            .split(path.sep)
            .join("/"),
          catalogue,
          changesStatus: comparison ? "ready" : "disabled",
          changedRoutes: changes?.changedRoutes,
          evidence: snapshot.componentChanges,
          comparison: comparison?.result,
          comparisonUrl: comparison
            ? `${comparison.directory}/review.json`
            : null,
          removedPreviews: comparison?.removedPreviews,
          revision: { content: 0, evidence: 0 },
        });
        for (const name of capturedShells) {
          const html = await fs.promises.readFile(
            path.join(stage, name),
            "utf8",
          );
          await writeText(
            stage,
            name,
            externalizeCapturedShell(name, html, readModel),
          );
        }
        await writeText(stage, CATALOGUE_PATH, serializeCatalogue(readModel));
        await stagePreviewArtifact(
          stage,
          manifest,
          removed,
          comparison,
          comparison?.removedPreviews,
        );
        if (
          inputs.fingerprint !==
          (await capturePublicationInputs(config, excludedRoots)).fingerprint
        )
          throw new Error(
            "consumer inputs changed during publication; retry with stable inputs",
          );
        if (compiled) {
          const after = await compileCatalogue(config);
          if (
            after.outputs.size !== compiled.outputs.size ||
            [...compiled.outputs].some(([route, content]) => {
              const current = after.outputs.get(route);
              return (
                current === undefined ||
                !generatedBytes(content).equals(generatedBytes(current))
              );
            })
          )
            throw new Error(
              "consumer inputs changed during publication; retry with stable inputs",
            );
        }
        assertSafeOutput(output, config.repoRoot);
        await prepared?.assertUnchanged();
        if (
          projectRealPath(resolveExportOutput(config, output, contextRoot)) !==
          transaction.output
        )
          throw new Error(
            "preview output changed its real location during publication",
          );
        await transaction.install();
      },
      () => transaction.close(),
    );
  } catch (cause) {
    throw new Error(
      `preview comparison failed or catalogue could not be exported: ${errorMessage(cause)}`,
      { cause },
    );
  }
}

function assertSafeOutput(output, repoRoot) {
  const contextRoot = path.join(repoRoot, ".context");
  const realRepoRoot = fs.realpathSync(repoRoot);
  const realContextRoot = projectRealPath(contextRoot);
  const realOutput = projectRealPath(output);
  if (
    !isInside(contextRoot, output) ||
    !isInside(realRepoRoot, realContextRoot) ||
    !isInside(realRepoRoot, realOutput) ||
    !isInside(realContextRoot, realOutput) ||
    realOutput === realContextRoot
  ) {
    throw new Error(`preview output must be inside ${contextRoot}`);
  }
}

function encodePath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}
