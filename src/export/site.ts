import path from "node:path";

import type {
  HistoricalManifest,
  ReviewArtifact,
  PageResourceEvidence,
  StaticDelivery,
} from "@mokly/viewer/data";
import {
  VIEWER_DIRECTORY,
  canonicalJson,
  entryRoute,
  GENERATED_DIRECTORY,
  parseStaticDelivery,
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
import { changedManifestPaths } from "../registry/changed_paths.js";
import { removedManifestEntries } from "../registry/changes.js";
import { baselineResourceConfig } from "../review/base_manifest.js";
import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
  loadShellFontAssets,
} from "../server/client_modules.js";
import { homePage, notFoundPage, viewPage } from "../server/pages.js";
import { screenResultEvidence } from "../server/screen_view_changes.js";

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
  pageEvidence: readonly PageResourceEvidence[] = [],
): {
  inventory: ExportInventory;
  delivery: StaticDelivery;
  shells: ReadonlyMap<string, StaticDelivery>;
} {
  const removedSnapshots =
    changesStatus === "ready"
      ? removedManifestEntries(
          compilation.manifest,
          baseline,
          comparison?.pairing?.moves,
        )
      : [];
  const removed = removedSnapshots.map(({ entry }) => entry);
  const catalogue = createCatalogue(
    compilation.manifest,
    removedSnapshots,
    changesStatus === "ready" ? (comparison?.pairing?.moves ?? []) : [],
  );
  const entries = [...compilation.manifest.entries, ...removed];
  const comparisonFiles = new Map(comparison?.files);
  if (comparison) parseReviewResult(comparison.result);
  if (comparison)
    comparisonFiles.set(
      "review.json",
      `${canonicalJson(comparison.result, 2)}\n`,
    );
  const generation = comparisonContentId(comparisonFiles);
  const prefix = `${VIEWER_DIRECTORY}/diffs/generations/${generation}`;
  const removedPreviews = staticRemovedPreviews(
    removedSnapshots,
    comparison,
    comparisonFiles,
  );
  const parsedDelivery = parseStaticDelivery({
    schemaVersion: 5,
    deploymentId: STAGED_DEPLOYMENT_ID,
    canonicalPath: "/",
    comparisonUrl: comparison ? `/${prefix}/review.json` : null,
  });
  if (parsedDelivery.kind !== "valid")
    throw exportError("Invalid static catalogue delivery metadata.");
  const delivery = parsedDelivery.value;
  const inventory = new ExportInventory();
  const shells = new Map<string, StaticDelivery>();
  const addShell = (name: string, html: string, descriptor: StaticDelivery) => {
    inventory.add(name, html);
    shells.set(name, descriptor);
  };
  const beforeDenial = exportResourceDenial(
    baselineResourceConfig(config, baseline),
    false,
    new Set(baseline.generatedFiles.map((file) => file.path)),
  );
  const afterDenial = exportResourceDenial(
    config,
    false,
    new Set(compilation.manifest.generatedFiles.map((file) => file.path)),
  );
  for (const [name, bytes] of comparisonFiles) {
    const resource = snapshotResourceRoute(name);
    const denial = resource
      ? (name.startsWith(snapshotSidePath("before"))
          ? beforeDenial
          : afterDenial)(resource)
      : undefined;
    if (denial)
      throw exportError(
        `Comparison contains a private export resource: ${name} (${denial})`,
      );
    inventory.add(`${prefix}/${name}`, bytes);
  }
  const materialIds = changedManifestPaths(
    compilation.manifest,
    baseline,
    config,
    contentChanges,
    comparison?.pairing?.moves,
  );
  const pageIds = new Set(
    compilation.manifest.entries.flatMap((entry) =>
      entry.kind === "page" || entry.kind === "document" ? [entry.path] : [],
    ),
  );
  const changes = comparison
    ? [
        ...comparison.result.changes.map(
          (item) => (item.after ?? item.before)!.path,
        ),
        ...materialIds.filter((id) => pageIds.has(id)),
        ...(comparison.pairing?.moves.map((move) => move.path) ?? []),
      ]
    : materialIds;
  const context: ShellContext = {
    base: comparison?.result.baseRef ?? "",
    ...(changesStatus === "ready" && comparison
      ? {
          changedEntries: [
            ...new Set([...changes, ...removed.map((entry) => entry.path)]),
          ],
          comparisons: true,
          componentChanges: {
            baseline,
            result: comparison.result,
            ...(pageEvidence.length ? { pageEvidence } : {}),
            ...(comparison.pairing ? { pairing: comparison.pairing } : {}),
            changedEntries: [
              ...new Set([
                ...comparison.result.changes
                  .filter((entry) => entry.reasons.length > 0)
                  .map((entry) => (entry.after ?? entry.before)!.path),
                ...materialIds.filter((id) => pageIds.has(id)),
              ]),
            ].sort(),
            ...screenResultEvidence(comparison.result),
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
    changedEntries: context.changedEntries,
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
    const route = entryRoute(entry.path);
    const canonicalPath = viewHref(entry.path);
    const descriptor = { ...delivery, canonicalPath };
    const html = viewPage(entry, catalogue, {
      ...context,
      activeId: entry.path,
      delivery: descriptor,
    });
    addShell(`view/${route}`, html, descriptor);
  }
  for (const [name, bytes] of publicFiles) {
    const logicalRoute = name.startsWith(`${GENERATED_DIRECTORY}/`)
      ? name.slice(GENERATED_DIRECTORY.length + 1)
      : undefined;
    const adapted = /\.html?$/i.test(name)
      ? adaptBrowseDocument(bytes.toString("utf8"), logicalRoute, catalogue)
      : bytes;
    inventory.add(`static/${name}`, adapted);
  }
  inventory.add(`${VIEWER_DIRECTORY}/shell.css`, SHELL_CSS);
  for (const [name, bytes] of loadBrowserClientModules()) {
    if (!LIVE_HOST_BUNDLES.has(name))
      inventory.add(`${VIEWER_DIRECTORY}/client/${name}`, bytes);
  }
  for (const [name, bytes] of loadBrowserNavigationModules())
    inventory.add(`${VIEWER_DIRECTORY}/navigation/${name}`, bytes);
  for (const [name, bytes] of loadShellFontAssets())
    inventory.add(`${VIEWER_DIRECTORY}/fonts/${name}`, bytes);
  return { inventory, delivery, shells };
}

function snapshotResourceRoute(name: string): string | undefined {
  const prefix = `${path.posix.dirname(snapshotSidePath("before"))}/`;
  if (!name.startsWith(prefix)) return undefined;
  const separator = name.indexOf("/", prefix.length);
  return separator < 0 ? undefined : name.slice(separator + 1);
}
