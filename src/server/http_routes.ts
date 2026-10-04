import type { ServerResponse } from "node:http";

import { VIEWER_DIRECTORY } from "@mokly/viewer/data";
import type { RenderCapability } from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";
import { shellContext, SHELL_CSS } from "@mokly/viewer/server";

import type { GeneratedFile } from "../build/generated_file.js";
import type { ResolvedConfig } from "../config/types.js";

import {
  openEventStream,
  serveClientModule,
  serveFontAsset,
  type ServedAssets,
} from "./browser_assets.js";
import type { ComponentChangeSnapshot } from "./component_changes.js";
import { handleDemandRequest } from "./demand/http.js";
import type { DocumentService } from "./demand/service.js";
import { homePage, notFoundPage } from "./pages.js";
import type { PublicCatalogueSource } from "./public_catalogue.js";
import { readPublicCatalogue } from "./public_catalogue_model.js";
import { send } from "./respond.js";
import type { ReviewRoutes } from "./review_routes.js";
import { serveStatic } from "./static_routes.js";
import type { ChangesStatus } from "./update_messages.js";
import { renderView } from "./view_routes.js";

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
  acceptedGenerated?: ReadonlyMap<string, GeneratedFile>,
  unavailableComparisons = false,
  assetClosure?: ReadonlySet<string>,
): Promise<void> {
  if (method !== "GET" && method !== "HEAD")
    return send(response, 405, "text/plain", "Method not allowed", method);
  const url = new URL(rawUrl, "http://mokly.invalid");
  if (
    url.pathname === `/${VIEWER_DIRECTORY}/catalogue.json` &&
    publicCatalogue
  ) {
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
  if (reviewRoutes && url.pathname.startsWith(`/${VIEWER_DIRECTORY}/diffs/`)) {
    void reviewRoutes.handle(url, response, method);
    return;
  }
  if (url.pathname === `/${VIEWER_DIRECTORY}/shell.css`)
    return send(response, 200, "text/css", SHELL_CSS, method);
  if (url.pathname === `/${VIEWER_DIRECTORY}/events`)
    return openEventStream(response, streams, requestVersion, method);
  if (url.pathname.startsWith(`/${VIEWER_DIRECTORY}/client/`)) {
    return serveClientModule(
      response,
      url.pathname.slice(`/${VIEWER_DIRECTORY}/client/`.length),
      assets.clientModules,
      method,
    );
  }
  if (url.pathname.startsWith(`/${VIEWER_DIRECTORY}/navigation/`)) {
    return serveClientModule(
      response,
      url.pathname.slice(`/${VIEWER_DIRECTORY}/navigation/`.length),
      assets.navigationModules,
      method,
    );
  }
  if (url.pathname.startsWith(`/${VIEWER_DIRECTORY}/fonts/`)) {
    return serveFontAsset(
      response,
      url.pathname.slice(`/${VIEWER_DIRECTORY}/fonts/`.length),
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
      assetClosure,
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
      acceptedGenerated,
    );
  return send(
    response,
    404,
    "text/html",
    notFoundPage(url.pathname, catalogue, context),
    method,
  );
}
