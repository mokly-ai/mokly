import http, { type ServerResponse } from "node:http";

import { createCatalogue } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import { parseManifest } from "../registry/manifest.js";

import { catalogueAtBaseline } from "./baseline_catalogue.js";
import {
  catalogueSnapshotForConfig,
  loadServedCatalogueSnapshot,
  loadLiveCatalogueSnapshot,
} from "./catalogue_snapshot.js";
import { advanceCatalogueState } from "./catalogue_update.js";
import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
  loadShellFontAssets,
} from "./client_modules.js";
import { ComponentChangeCache } from "./component_changes.js";
import { handleControls, localHost } from "./controls/http.js";
import { ComponentRenderService } from "./controls/service.js";
import { ForegroundActivity } from "./demand/activity.js";
import { DocumentService } from "./demand/service.js";
import { handleCatalogueRequest } from "./http_routes.js";
import { closeCatalogueHttp } from "./http_shutdown.js";
import type { RunningServer, ServerOptions } from "./http_types.js";
import { listenOnAvailablePort } from "./ports.js";
import { LivePublicCatalogue } from "./public_catalogue.js";
import type { PublicComparison } from "./public_review.js";
import { send } from "./respond.js";
import { ReviewRoutes } from "./review_routes.js";
import type { ChangesStatus } from "./update_messages.js";

/** Start Browse only after manifest validation succeeds. */
export async function startCatalogueServer(
  config: ResolvedConfig,
  options: ServerOptions,
): Promise<RunningServer> {
  const snapshot =
    options.snapshot ??
    (options.manifest?.schemaVersion === "live-index-1"
      ? await loadLiveCatalogueSnapshot(config, options.manifest)
      : await loadServedCatalogueSnapshot(
          config,
          options.manifest ||
            options.componentChanges ||
            options.componentChangeSource
            ? undefined
            : options.review
              ? options.base
              : undefined,
          options.manifest,
          options.review?.repository,
        ));
  const validated = catalogueSnapshotForConfig(snapshot, config);
  const changes = validated.changes;
  let catalogue = validated.catalogue;
  let manifest = catalogue.manifest;
  let controls = options.componentRuntime
    ? new ComponentRenderService(options.componentRuntime)
    : undefined;
  const activity = new ForegroundActivity(options.onForeground ?? (() => {}));
  const createDocuments = (runtime: ComponentRuntime) =>
    runtime.manifest.schemaVersion === "live-index-1"
      ? new DocumentService(runtime, activity.channel(), {
          onDocument: (document) => {
            if (runtime.generation === controls?.capability().generation)
              publicCatalogue.acceptDocument(
                document,
                publicInput(),
                contentVersion,
              );
            options.onPreviewResources?.({
              generation: runtime.generation,
              documents: [
                [document.route, document.html],
                ...(document.watchDocuments ?? []),
              ],
            });
          },
        })
      : undefined;
  let documents = options.componentRuntime
    ? createDocuments(options.componentRuntime)
    : undefined;
  const clientModules = timeSync("server.client-modules", () =>
    loadBrowserClientModules(),
  );
  const navigationModules = timeSync("server.navigation-modules", () =>
    loadBrowserNavigationModules(),
  );
  const fontAssets = timeSync("server.fonts", () => loadShellFontAssets());
  const streams = new Set<ServerResponse>();
  const reviewRoutes = options.review
    ? new ReviewRoutes(
        options.review,
        () =>
          manifest.schemaVersion === 5 && componentChanges?.comparison
            ? {
                ...componentChanges.comparison,
                before: componentChanges.baseline,
                after: manifest,
                ...(componentChanges.result
                  ? { result: componentChanges.result }
                  : {}),
              }
            : undefined,
        (comparison) => {
          if (changesStatus !== "ready") return;
          publicCatalogue.publish(publicInput(comparison), contentVersion);
          publicComparison = comparison;
        },
      )
    : undefined;
  let componentChanges =
    options.componentChanges ??
    snapshot.componentChanges ??
    (options.review && options.componentChangeSource
      ? await new ComponentChangeCache(options.componentChangeSource).read(
          options.updateVersion ?? 1,
        )
      : undefined);
  let activeCatalogue = componentChanges
    ? catalogueAtBaseline(manifest, componentChanges.baseline)
    : catalogue;
  let changedRoutes =
    changes?.changedRoutes ??
    options.changedRoutes ??
    componentChanges?.changedRoutes;
  let changesStatus: ChangesStatus =
    options.changesStatus ??
    (changedRoutes || componentChanges ? "ready" : "unavailable");
  let updateVersion = options.updateVersion ?? 1;
  let contentVersion = updateVersion;
  let publicComparison: PublicComparison | undefined;
  const publicInput = (
    comparison: PublicComparison | undefined = publicComparison,
  ) => ({
    catalogue: activeCatalogue,
    changesStatus:
      options.liveChanges === false && !options.review
        ? ("disabled" as const)
        : changesStatus,
    changedRoutes,
    evidence: componentChanges,
    comparison: comparison?.result,
    comparisonUrl: comparison?.path ?? null,
  });
  const publicCatalogue = new LivePublicCatalogue(
    config,
    publicInput(),
    contentVersion,
  );
  const server = http.createServer((request, response) => {
    if (controls && !localHost(request))
      return send(
        response,
        403,
        "text/plain",
        "This request is not allowed.",
        request.method ?? "GET",
      );
    if (controls && request.url?.startsWith("/__mokly/components/")) {
      const busy = activity.channel();
      busy(true);
      void handleControls(request, response, controls).finally(() =>
        busy(false),
      );
      return;
    }
    const requestedVersion = updateVersion;
    const requestedChanges = changedRoutes;
    void handleCatalogueRequest(
      request.url ?? "/",
      request.method ?? "GET",
      response,
      activeCatalogue,
      config,
      options.base,
      () => requestedChanges,
      streams,
      { clientModules, fontAssets, navigationModules },
      () => requestedVersion,
      reviewRoutes,
      componentChanges,
      controls?.capability(),
      documents,
      options.liveChanges === false ? undefined : changesStatus,
      contentVersion,
      publicCatalogue,
    ).catch(() => {
      if (!response.destroyed && !response.headersSent)
        send(
          response,
          500,
          "text/plain",
          "Could not open this page.",
          request.method ?? "GET",
        );
    });
  });
  await timeAsync("server.listen", () =>
    listenOnAvailablePort(server, options.port, options.strictPort ?? false),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new MoklyError(
      "server-failed",
      "server did not expose a TCP address",
    );
  }
  return {
    completeCatalogue(complete, generation): boolean {
      if (controls?.capability().generation !== generation) return false;
      parseManifest(complete);
      const nextCatalogue = createCatalogue(complete);
      const nextActive = componentChanges
        ? catalogueAtBaseline(complete, componentChanges.baseline)
        : nextCatalogue;
      publicCatalogue.publish(
        { ...publicInput(), catalogue: nextActive },
        contentVersion,
      );
      manifest = complete;
      catalogue = nextCatalogue;
      activeCatalogue = nextActive;
      return true;
    },
    close(): Promise<void> {
      return closeCatalogueHttp(server, streams, [
        reviewRoutes,
        controls,
        documents,
      ]);
    },
    port: address.port,
    replaceComponentRuntime(runtime): void {
      publicCatalogue.clearUsage();
      void documents?.close();
      documents = createDocuments(runtime);
      if (runtime.manifest.schemaVersion === "live-index-1") {
        manifest = runtime.manifest;
        catalogue = createCatalogue(manifest);
        activeCatalogue = catalogue;
      }
      if (controls) controls.replace(runtime);
      else controls = new ComponentRenderService(runtime);
    },
    publishUpdate(update = {}): void {
      const next = advanceCatalogueState(
        {
          catalogue,
          activeCatalogue,
          changedRoutes,
          componentChanges,
          changesStatus,
          updateVersion,
          contentVersion,
        },
        update,
      );
      if (!next) return;
      publicCatalogue.publish(
        {
          ...publicInput(),
          catalogue: next.activeCatalogue,
          changedRoutes: next.changedRoutes,
          evidence: next.componentChanges,
          changesStatus:
            options.liveChanges === false && !options.review
              ? "disabled"
              : next.changesStatus,
          comparison: undefined,
          comparisonUrl: null,
        },
        next.contentVersion,
        update.kind === "evidence",
      );
      ({
        activeCatalogue,
        changedRoutes,
        componentChanges,
        changesStatus,
        updateVersion,
        contentVersion,
      } = next);
      reviewRoutes?.invalidate();
      publicComparison = undefined;
      const payload = `event: update\ndata: ${updateVersion}\n\n`;
      for (const stream of streams) stream.write(payload);
    },
    url: `http://127.0.0.1:${address.port}`,
  };
}
