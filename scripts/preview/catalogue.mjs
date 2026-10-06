import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { viewHref } from "@mokly/viewer/data";

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
import {
  externalizeCapturedShell,
  readCapturedShellCatalogue,
} from "../../dist/export/captured_shell.js";
import { withExportCleanup } from "../../dist/export/cleanup.js";
import { assertExportOwnership } from "../../dist/export/ownership.js";
import { resolveExportOutput } from "../../dist/export/paths.js";
import { ExportTransaction } from "../../dist/export/transaction.js";
import { publicationOptions } from "../../dist/publication/options.js";
import { copyPublicFiles } from "../../dist/publication/resources.js";
import { prepareReviewRepository } from "../../dist/review/prepare.js";
import { startCatalogueServer } from "../../dist/server/http.js";

import { stagePreviewArtifact } from "./artifact.mjs";
import { publicationSnapshot } from "./baseline.mjs";
import { captureAssets, capturePage, writeText } from "./capture.mjs";
import {
  captureComparison,
  capturePublicationPagePreviews,
  previewComparisonProvider,
  publishComparison,
} from "./comparisons.mjs";
import { capturePublicationInputs } from "./inputs.mjs";

/** Capture already-built output; the supported npm command builds before this boundary. */
export async function buildPreview(config, output, options = {}) {
  const capability = publicationOptions(options);
  assertSafeOutput(output, config.repoRoot);
  const contextRoot = path.join(config.repoRoot, ".context");
  const destination = resolveExportOutput(config, output, contextRoot);
  try {
    await assertExportOwnership(destination);
  } catch (cause) {
    throw new Error(
      `refusing to replace unowned preview directory: ${output}. ${errorMessage(cause)}`,
      { cause },
    );
  }
  const transaction = await ExportTransaction.open(destination);
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
        const { incompatible, snapshot, changeEvidence } =
          await publicationSnapshot(
            config,
            git,
            base,
            compiled?.manifest ?? inputs.manifest,
            compiled,
            excludedRoots,
          );
        const { catalogue, changes } = snapshot;
        const manifest = catalogue.manifest;
        const review =
          git && !incompatible
            ? previewComparisonProvider(
                config,
                stage,
                base,
                git,
                changeEvidence,
              )
            : undefined;
        const server = await startCatalogueServer(config, {
          base,
          ...(incompatible ? { changesStatus: "unavailable" } : {}),
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
            const route = viewHref(entry.path);
            const name = `${route.slice(1)}index.html`;
            await capturePage(server.url, route, stage, name);
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
          changesStatus: comparison
            ? "ready"
            : incompatible
              ? "unavailable"
              : "disabled",
          changedEntries: changes?.changedEntries,
          evidence: snapshot.componentChanges,
          comparison: comparison?.result,
          comparisonUrl: comparison
            ? `${comparison.directory}/review.json`
            : null,
          removedPreviews: comparison?.removedPreviews,
          revision: { content: 0, evidence: 0 },
        });
        const capturedCatalogue = readCapturedShellCatalogue(readModel);
        for (const name of capturedShells) {
          const html = await fs.promises.readFile(
            path.join(stage, name),
            "utf8",
          );
          await writeText(
            stage,
            name,
            externalizeCapturedShell(name, html, capturedCatalogue),
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
