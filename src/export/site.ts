import path from "node:path";

import type { HistoricalManifest, ReviewArtifact } from "@mokly/viewer/data";
import {
  canonicalJson,
  entryRoute,
  parseStaticDelivery,
  type StaticDelivery,
  parseReviewResult,
  snapshotSidePath,
  viewHref,
} from "@mokly/viewer/data";
import { createCatalogue, SHELL_CSS } from "@mokly/viewer/server";
import type { ShellContext } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../browse/document_adapter.js";
import type { Compilation } from "../build/compile.js";
import { projectCatalogue } from "../catalogue/projection.js";
import {
  CATALOGUE_PATH,
  serializeCatalogue,
} from "../catalogue/serialization.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { staticRemovedPreviews } from "../publication/removed_previews.js";
import { changedManifestIds } from "../registry/changed_ids.js";
import { removedManifestEntries } from "../registry/changes.js";
import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
  loadShellFontAssets,
} from "../server/client_modules.js";
import { homePage, notFoundPage, viewPage } from "../server/pages.js";

import { comparisonContentId } from "./content_id.js";
import { exportError } from "./error.js";
import { ExportInventory } from "./inventory.js";
import { exportResourceDenial } from "./resource_policy.js";
import { STAGED_DEPLOYMENT_ID } from "./shell_metadata.js";

const LIVE_HOST_BUNDLES = new Set([
  "host_capabilities.js",
  "host_capability_descriptor.js",
  "react_capabilities.js",
  "react_capability_updates.js",
  "react_transports.js",
  "react_update_controller.js",
  "react-host.js",
]);

/** Assemble one complete shell/resource/comparison tree without a live server. */
export function assembleExport(
  config: ResolvedConfig,
  compilation: Compilation,
  baseline: HistoricalManifest,
  comparison: ReviewArtifact | undefined,
  publicFiles: ReadonlyMap<string, Buffer>,
  contentChanges: readonly string[],
  changesStatus: "disabled" | "ready" | "unavailable" = comparison
    ? "ready"
    : "disabled",
): {
  inventory: ExportInventory;
  delivery: StaticDelivery;
  shells: ReadonlyMap<string, StaticDelivery>;
} {
  const removedSnapshots =
    changesStatus === "ready"
      ? removedManifestEntries(compilation.manifest, baseline)
      : [];
  const removed = removedSnapshots.map(({ entry }) => entry);
  const catalogue = createCatalogue(compilation.manifest, removedSnapshots);
  const entries = [...compilation.manifest.entries, ...removed];
  const comparisonFiles = new Map(comparison?.files);
  if (comparison) parseReviewResult(comparison.result);
  if (comparison)
    comparisonFiles.set(
      "review.json",
      `${canonicalJson(comparison.result, 2)}\n`,
    );
  const generation = comparisonContentId(comparisonFiles);
  const prefix = `__mokly/diffs/__generations/${generation}`;
  const removedPreviews = staticRemovedPreviews(
    removedSnapshots,
    comparison,
    comparisonFiles,
  );
  const delivery = parseStaticDelivery({
    schemaVersion: 3,
    deploymentId: STAGED_DEPLOYMENT_ID,
    canonicalPath: "/",
    comparisonUrl: comparison ? `/${prefix}/review.json` : null,
  });
  if (!delivery)
    throw exportError("Invalid static catalogue delivery metadata.");
  const inventory = new ExportInventory();
  const shells = new Map<string, StaticDelivery>();
  const addShell = (name: string, html: string, descriptor: StaticDelivery) => {
    inventory.add(name, html);
    shells.set(name, descriptor);
  };
  const resourceDenial = exportResourceDenial(config, false);
  for (const [name, bytes] of comparisonFiles) {
    const resource = snapshotResourceRoute(name);
    const denial = resource ? resourceDenial(resource) : undefined;
    if (denial)
      throw exportError(
        `Comparison contains a private export resource: ${name} (${denial})`,
      );
    inventory.add(`${prefix}/${name}`, bytes);
  }
  const materialIds = changedManifestIds(
    compilation.manifest,
    baseline,
    config,
    contentChanges,
  );
  const pageIds = new Set(
    compilation.manifest.entries.flatMap((entry) =>
      entry.kind === "page" ? [entry.id] : [],
    ),
  );
  const changes = comparison
    ? [
        ...comparison.result.changes.map(
          (item) => (item.after ?? item.before)!.id,
        ),
        ...materialIds.filter((id) => pageIds.has(id)),
      ]
    : materialIds;
  const context: ShellContext = {
    base: comparison?.result.baseRef ?? "",
    ...(changesStatus === "ready" && comparison
      ? {
          changedIds: [
            ...new Set([...changes, ...removed.map((entry) => entry.id)]),
          ],
          comparisons: true,
          componentChanges: {
            baseline,
            result: comparison.result,
            screenEvidence: comparison.result.screens
              .map(({ id, views }) => ({
                id,
                views: views
                  .filter(
                    (view) =>
                      view.reasons?.length || view.excludedResources?.length,
                  )
                  .map(
                    ({
                      viewport,
                      colorScheme,
                      reasons,
                      excludedResources,
                    }) => ({
                      viewport,
                      colorScheme,
                      ...(reasons ? { reasons } : {}),
                      ...(excludedResources ? { excludedResources } : {}),
                    }),
                  ),
              }))
              .filter((screen) => screen.views.length > 0),
            screenViews: comparison.result.screens.map(({ id, views }) => ({
              id,
              views: views.map(({ viewport, colorScheme, state }) => ({
                viewport,
                colorScheme,
                state,
              })),
            })),
          },
        }
      : { comparisons: changesStatus !== "disabled" }),
    updateVersion: 0,
    delivery,
  };
  const readModel = projectCatalogue({
    configPath: toPosixPath(path.relative(config.repoRoot, config.configPath)),
    catalogue,
    changesStatus,
    changedIds: context.changedIds,
    evidence: context.componentChanges,
    comparison: comparison?.result,
    comparisonUrl: delivery.comparisonUrl?.slice(1) ?? null,
    removedPreviews,
    revision: { content: 0, evidence: 0 },
  });
  context.readModel = readModel;
  inventory.add(CATALOGUE_PATH, serializeCatalogue(readModel));
  addShell("index.html", homePage(catalogue, context), delivery);
  const notFoundDelivery = { ...delivery, canonicalPath: "/404.html" };
  addShell(
    "404.html",
    notFoundPage("", catalogue, {
      ...context,
      delivery: notFoundDelivery,
    }),
    notFoundDelivery,
  );
  for (const entry of entries) {
    const route = entryRoute(entry.kind, entry.id);
    const canonicalPath = viewHref(entry.kind, entry.id);
    const descriptor = { ...delivery, canonicalPath };
    const html = viewPage(entry, catalogue, {
      ...context,
      activeId: entry.id,
      delivery: descriptor,
    });
    addShell(`view/${route}`, html, descriptor);
  }
  for (const [name, bytes] of publicFiles) {
    const adapted = /\.html?$/i.test(name)
      ? adaptBrowseDocument(bytes.toString("utf8"), name, catalogue)
      : bytes;
    inventory.add(`static/${name}`, adapted);
  }
  inventory.add("__mokly/shell.css", SHELL_CSS);
  for (const [name, bytes] of loadBrowserClientModules()) {
    if (!LIVE_HOST_BUNDLES.has(name))
      inventory.add(`__mokly/client/${name}`, bytes);
  }
  for (const [name, bytes] of loadBrowserNavigationModules())
    inventory.add(`__mokly/navigation/${name}`, bytes);
  for (const [name, bytes] of loadShellFontAssets())
    inventory.add(`__mokly/fonts/${name}`, bytes);
  return { inventory, delivery, shells };
}

function snapshotResourceRoute(name: string): string | undefined {
  const prefix = `${path.posix.dirname(snapshotSidePath("before"))}/`;
  if (!name.startsWith(prefix)) return undefined;
  const separator = name.indexOf("/", prefix.length);
  return separator < 0 ? undefined : name.slice(separator + 1);
}
