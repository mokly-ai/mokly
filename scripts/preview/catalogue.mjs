import fs from "node:fs";
import path from "node:path";

import { isInside, projectRealPath } from "../../dist/config/paths.js";
import { errorMessage } from "../../dist/errors.js";
import { withExportCleanup } from "../../dist/export/cleanup.js";
import { assertExportOwnership } from "../../dist/export/ownership.js";
import { resolveExportOutput } from "../../dist/export/paths.js";
import { ExportTransaction } from "../../dist/export/transaction.js";
import { publicationOptions } from "../../dist/publication/options.js";
import { copyPublicFiles } from "../../dist/publication/resources.js";
import { prepareReviewRepository } from "../../dist/review/prepare.js";
import { loadCatalogueSnapshot } from "../../dist/server/catalogue_snapshot.js";
import { computeCatalogueChanges } from "../../dist/server/changed.js";
import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
  loadShellFontAssets,
} from "../../dist/server/client_modules.js";
import { startCatalogueServer } from "../../dist/server/http.js";

import { previewOwnership, stagePreviewArtifact } from "./artifact.mjs";
import {
  captureComparison,
  previewComparisonProvider,
  publishComparison,
} from "./comparisons.mjs";
import { capturePublicationInputs } from "./inputs.mjs";

const liveUpdateScript =
  '<script src="/__mokly/client/browser.js" type="module"></script>';

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
        const snapshot = await loadCatalogueSnapshot(
          config,
          git
            ? (manifest) => computeCatalogueChanges(config, base, git, manifest)
            : undefined,
          inputs.manifest,
        );
        const { catalogue, changes } = snapshot;
        const manifest = catalogue.manifest;
        const review = git
          ? previewComparisonProvider(config, stage, base, git)
          : undefined;
        const server = await startCatalogueServer(config, {
          base,
          liveChanges: false,
          snapshot,
          port: 0,
          ...(review ? { review } : {}),
        });
        let comparison;
        let removed = [];
        try {
          if (review) {
            comparison = await captureComparison(server.url);
            removed = changes.removedEntries.map(({ entry }) => entry);
          }
          await capturePage(server.url, "/", stage, "index.html");
          for (const entry of [...manifest.entries, ...removed]) {
            if (entry.kind === "collection") continue;
            await capturePage(
              server.url,
              `/view/${encodePath(entry.route)}`,
              stage,
              `view/${entry.route}`,
            );
          }
          await capturePage(
            server.url,
            "/preview-route-that-does-not-exist",
            stage,
            "404.html",
            404,
          );
          await captureAssets(server.url, stage);
        } finally {
          await server.close();
        }
        if (review && comparison)
          comparison = await publishComparison(review, comparison, stage);
        await copyPublicFiles(config, catalogue, stage, excludedRoots);
        await stagePreviewArtifact(stage, manifest, removed, comparison);
        if (
          inputs.fingerprint !==
          (await capturePublicationInputs(config, excludedRoots)).fingerprint
        )
          throw new Error(
            "consumer inputs changed during publication; retry with stable inputs",
          );
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

async function captureAssets(serverUrl, stage) {
  for (const asset of shellAssets()) {
    const response = await fetch(`${serverUrl}${asset}`);
    if (!response.ok)
      throw new Error(`preview asset ${asset} returned ${response.status}`);
    await writeFile(
      stage,
      asset.slice(1),
      Buffer.from(await response.arrayBuffer()),
    );
  }
}

function shellAssets() {
  return [
    "/__mokly/shell.css",
    ...[...loadBrowserClientModules().keys()]
      .filter((name) => name !== "browser.js" && name !== "live_updates.js")
      .map((name) => `/__mokly/client/${name}`),
    ...[...loadBrowserNavigationModules().keys()].map(
      (name) => `/__mokly/navigation/${name}`,
    ),
    ...[...loadShellFontAssets().keys()].map(
      (name) => `/__mokly/fonts/${name}`,
    ),
  ];
}

async function capturePage(
  serverUrl,
  route,
  stage,
  relativePath,
  expectedStatus = 200,
) {
  const response = await fetch(`${serverUrl}${route}`);
  if (response.status !== expectedStatus) {
    throw new Error(
      `preview page ${route} returned ${response.status}, expected ${expectedStatus}`,
    );
  }
  const html = await response.text();
  if (!html.includes(liveUpdateScript)) {
    throw new Error(`preview page ${route} is missing its live-update script`);
  }
  await writeText(stage, relativePath, staticPage(html));
}

function staticPage(html) {
  return html
    .replace(liveUpdateScript, "")
    .replace(
      /(href|src|data-fragment-light|data-fragment-dark)="\/(static|view)\/([^"]+)\.html"/g,
      '$1="/$2/$3"',
    );
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

async function writeText(root, relative, content) {
  await writeFile(root, relative, Buffer.from(content));
}

async function writeFile(root, relative, content) {
  const target = path.join(root, relative);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, content);
}
