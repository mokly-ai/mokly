import type { IncomingHttpHeaders, ServerResponse } from "node:http";

import type { RenderCapability } from "@mokly/viewer/data";
import type { RebuildStatus } from "@mokly/viewer/runtime";
import type { Catalogue } from "@mokly/viewer/server";
import { shellContext, SHELL_CSS } from "@mokly/viewer/server";

import type { GeneratedFile } from "../build/generated_file.js";
import type { ResolvedConfig } from "../config/types.js";
import type { InteractiveServer } from "../interactive/server.js";

import {
  openEventStream,
  serveClientModule,
  serveFontAsset,
  type ServedAssets,
} from "./browser_assets.js";
import type { ComponentChangeSnapshot } from "./component_changes.js";
import { handleDemandRequest } from "./demand/http.js";
import type { DocumentService } from "./demand/service.js";
import { handleInteractivePreparation } from "./interactive_prepare.js";
import { homePage, notFoundPage } from "./pages.js";
import type { PublicCatalogueSource } from "./public_catalogue.js";
import { readPublicCatalogue } from "./public_catalogue_model.js";
import { send } from "./respond.js";
import type { ReviewRoutes } from "./review_routes.js";
import { serveStatic } from "./static_routes.js";
import type { ChangesStatus } from "./update_messages.js";
import { renderView } from "./view_routes.js";
import type { WorkspaceEligibilitySource } from "./workspace_eligibility.js";

/** Dispatch a request against one validated catalogue generation. */
export async function handleCatalogueRequest(
  rawUrl: string,
  method: string,
  response: ServerResponse,
  catalogue: Catalogue,
  config: ResolvedConfig,
  base: string,
  currentChangedIds: () => readonly string[] | undefined,
  streams: Set<ServerResponse>,
  assets: ServedAssets,
  currentVersion: () => number,
  reviewRoutes?: ReviewRoutes,
  componentChanges?: ComponentChangeSnapshot,
  renderCapability?: RenderCapability,
  documents?: DocumentService,
  changesStatus?: ChangesStatus,
  contentVersion?: number,
  publicCatalogue?: PublicCatalogueSource,
  interactive?: InteractiveServer,
  requestHeaders: IncomingHttpHeaders = {},
  workspaceEligibility?: WorkspaceEligibilitySource,
  currentRebuildStatus?: () => RebuildStatus | undefined,
  acceptedGenerated?: ReadonlyMap<string, GeneratedFile>,
  unavailableComparisons = false,
): Promise<void> {
  const url = new URL(rawUrl, "http://mokly.invalid");
  if (
    await handleInteractivePreparation(
      url,
      method,
      response,
      requestHeaders,
      interactive,
    )
  )
    return;
  if (method !== "GET" && method !== "HEAD")
    return send(response, 405, "text/plain", "Method not allowed", method);
  if (url.pathname === "/__mokly/catalogue.json" && publicCatalogue) {
    response.setHeader("Cache-Control", "no-store");
    return send(
      response,
      200,
      "application/json",
      publicCatalogue.read(),
      method,
    );
  }
  if (
    documents &&
    (await handleDemandRequest(url, method, response, catalogue, documents))
  )
    return;
  const requestVersion = currentVersion();
  const requestRebuildStatus = currentRebuildStatus?.();
  if (reviewRoutes && url.pathname.startsWith("/__mokly/diffs/")) {
    void reviewRoutes.handle(url, response, method);
    return;
  }
  if (url.pathname === "/__mokly/shell.css")
    return send(response, 200, "text/css", SHELL_CSS, method);
  if (url.pathname === "/__mokly/events")
    return openEventStream(
      response,
      streams,
      requestVersion,
      method,
      requestRebuildStatus,
      interactive?.descriptor(),
    );
  if (url.pathname.startsWith("/__mokly/client/")) {
    return serveClientModule(
      response,
      url.pathname.slice("/__mokly/client/".length),
      assets.clientModules,
      method,
    );
  }
  if (url.pathname.startsWith("/__mokly/navigation/")) {
    return serveClientModule(
      response,
      url.pathname.slice("/__mokly/navigation/".length),
      assets.navigationModules,
      method,
    );
  }
  if (url.pathname.startsWith("/__mokly/fonts/")) {
    return serveFontAsset(
      response,
      url.pathname.slice("/__mokly/fonts/".length),
      assets.fontAssets,
      method,
    );
  }
  if (url.pathname.startsWith("/static/"))
    return serveStatic(
      response,
      url.pathname.slice(8),
      config,
      catalogue,
      method,
      acceptedGenerated,
    );
  const changed =
    componentChanges?.changedIds ??
    (componentChanges?.result
      ? componentChanges.result.changes.map(
          (entry) => (entry.after ?? entry.before)!.id,
        )
      : currentChangedIds());
  const context = shellContext(
    base,
    changed
      ? [
          ...new Set([
            ...changed,
            ...catalogue.removedEntries.map(({ entry }) => entry.id),
          ]),
        ]
      : undefined,
    requestVersion,
  );
  if (publicCatalogue) context.readModel = readPublicCatalogue(publicCatalogue);
  context.comparisons = reviewRoutes !== undefined || unavailableComparisons;
  if (contentVersion !== undefined) context.contentVersion = contentVersion;
  if (documents && renderCapability)
    context.previewGeneration = renderCapability.generation;
  if (changesStatus) context.changesStatus = changed ? "ready" : changesStatus;
  if (componentChanges) context.componentChanges = componentChanges;
  if (renderCapability) context.renderCapability = renderCapability;
  if (interactive) context.interactive = interactive.descriptor();
  if (requestRebuildStatus) context.rebuildStatus = requestRebuildStatus;
  if (url.pathname === "/")
    return send(
      response,
      200,
      "text/html",
      homePage(catalogue, context),
      method,
    );
  if (url.pathname.startsWith("/view/"))
    return renderView(
      response,
      url,
      url.pathname.slice(6),
      catalogue,
      config,
      context,
      method,
      documents,
      workspaceEligibility,
    );
  return send(
    response,
    404,
    "text/html",
    notFoundPage(url.pathname, catalogue, context),
    method,
  );
}
