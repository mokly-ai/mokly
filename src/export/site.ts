import { adaptBrowseDocument } from "../browse/document_adapter.js";
import type { Compilation } from "../build/compile.js";
import { canonicalJson } from "../components/data.js";
import type { ResolvedConfig } from "../config/types.js";
import {
  catalogueViewHref,
  parseStaticDelivery,
  type StaticDelivery,
} from "../navigation/delivery.js";
import { changedManifestRoutes } from "../registry/changed_routes.js";
import { removedManifestEntries } from "../registry/changes.js";
import type { Manifest } from "../registry/types.js";
import { parseReviewResult } from "../review/result_validation.js";
import type { ReviewArtifact } from "../review/types.js";
import { createCatalogue } from "../server/catalogue.js";
import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
  loadShellFontAssets,
} from "../server/client_modules.js";
import { homePage, notFoundPage, viewPage } from "../server/pages.js";
import type { ShellContext } from "../server/shell/context.js";
import { SHELL_CSS } from "../server/shell/css.js";

import { comparisonContentId } from "./content_id.js";
import { exportError } from "./error.js";
import { ExportInventory } from "./inventory.js";
import { exportResourceDenial } from "./resource_policy.js";
import { STAGED_DEPLOYMENT_ID } from "./shell_metadata.js";

/** Assemble one complete shell/resource/comparison tree without a live server. */
export function assembleExport(
  config: ResolvedConfig,
  compilation: Compilation,
  baseline: Manifest,
  comparison: ReviewArtifact | undefined,
  publicFiles: ReadonlyMap<string, Buffer>,
  contentChanges: readonly string[],
): {
  inventory: ExportInventory;
  delivery: StaticDelivery;
  shells: ReadonlyMap<string, StaticDelivery>;
} {
  const current = createCatalogue(compilation.manifest);
  const removedSnapshots = removedManifestEntries(
    compilation.manifest,
    baseline,
  );
  const removed = removedSnapshots.map(({ entry }) => entry);
  const catalogue = createCatalogue(compilation.manifest, removedSnapshots);
  const entries = [...current.byRoute.values(), ...removed];
  const idRoutes: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  for (const entry of [...compilation.manifest.entries, ...removed]) {
    if (entry.kind === "collection") continue;
    if (
      removed.some((candidate) => candidate === entry) &&
      current.byId.has(entry.id)
    )
      continue;
    idRoutes[entry.id] = catalogueViewHref(entry.route);
  }
  const comparisonFiles = new Map(comparison?.files);
  if (comparison?.result.schemaVersion === 3)
    parseReviewResult(comparison.result);
  if (comparison)
    comparisonFiles.set(
      "review.json",
      `${comparison.result.schemaVersion === 3 ? canonicalJson(comparison.result, 2) : JSON.stringify(comparison.result, null, 2)}\n`,
    );
  const generation = comparisonContentId(comparisonFiles);
  const prefix = `__mokly/diffs/__generations/${generation}`;
  const delivery = parseStaticDelivery({
    schemaVersion: 2,
    deploymentId: STAGED_DEPLOYMENT_ID,
    canonicalPath: "/",
    comparisonUrl: comparison ? `/${prefix}/review.json` : null,
    idRoutes,
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
    const denial = name.startsWith("snapshots/")
      ? resourceDenial(name.slice(name.indexOf("/", 10) + 1))
      : undefined;
    if (denial)
      throw exportError(
        `Comparison contains a private export resource: ${name} (${denial})`,
      );
    inventory.add(`${prefix}/${name}`, bytes);
  }
  const materialRoutes = changedManifestRoutes(
    compilation.manifest,
    baseline,
    config,
    contentChanges,
  );
  const pageRoutes = new Set(
    compilation.manifest.entries.flatMap((entry) =>
      entry.kind === "page" ? [entry.route] : [],
    ),
  );
  const changes =
    comparison?.result.schemaVersion === 3
      ? [
          ...comparison.result.changes.map(
            (item) => (item.after ?? item.before)!.route,
          ),
          ...materialRoutes.filter((route) => pageRoutes.has(route)),
        ]
      : materialRoutes;
  const context: ShellContext = {
    base: comparison?.result.baseRef ?? "",
    ...(comparison
      ? {
          changedRoutes: [
            ...new Set([...changes, ...removed.map((entry) => entry.route)]),
          ],
          comparisons: true,
          componentChanges: {
            baseline,
            ...(comparison.result.schemaVersion === 3
              ? { result: comparison.result }
              : {
                  screenEvidence: comparison.result.screens
                    .map(({ route, views }) => ({
                      route,
                      views: views
                        .filter(
                          (view) =>
                            view.reasons?.length ||
                            view.excludedResources?.length,
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
                }),
          },
        }
      : { comparisons: false }),
    updateVersion: 0,
    delivery,
  };
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
    if (!("route" in entry)) continue;
    const canonicalPath = catalogueViewHref(entry.route);
    const descriptor = { ...delivery, canonicalPath };
    const html = viewPage(entry, catalogue, {
      ...context,
      activeRoute: entry.route,
      delivery: descriptor,
    });
    addShell(`view/${entry.route}`, html, descriptor);
    if (
      "id" in entry &&
      typeof entry.id === "string" &&
      idRoutes[entry.id] === canonicalPath
    )
      addShell(`id/${entry.id}/index.html`, html, descriptor);
  }
  for (const [name, bytes] of publicFiles) {
    const adapted = /\.html?$/i.test(name)
      ? adaptBrowseDocument(bytes.toString("utf8"), name, catalogue)
      : bytes;
    inventory.add(`static/${name}`, adapted);
  }
  inventory.add("__mokly/shell.css", SHELL_CSS);
  for (const [name, bytes] of loadBrowserClientModules()) {
    if (name !== "browser.js" && name !== "live_updates.js")
      inventory.add(`__mokly/client/${name}`, bytes);
  }
  for (const [name, bytes] of loadBrowserNavigationModules())
    inventory.add(`__mokly/navigation/${name}`, bytes);
  for (const [name, bytes] of loadShellFontAssets())
    inventory.add(`__mokly/fonts/${name}`, bytes);
  return { inventory, delivery, shells };
}
