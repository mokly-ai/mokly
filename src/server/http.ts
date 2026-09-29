import http, { type ServerResponse } from "node:http";

import type { RebuildStatus } from "@mokly/viewer/runtime";
import { createCatalogue } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import type { InteractiveServer } from "../interactive/server.js";
import { parseManifest } from "../registry/manifest.js";

import { catalogueAtBaseline } from "./baseline_catalogue.js";
import { catalogueSnapshotForConfig } from "./catalogue_snapshot.js";
import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
  loadShellFontAssets,
} from "./client_modules.js";
import { ComponentChangeCache } from "./component_changes.js";
import { ComponentRenderService } from "./controls/service.js";
import { ForegroundActivity } from "./demand/activity.js";
import { DocumentService } from "./demand/service.js";
import { handleComponentHttpRequest } from "./http_components.js";
import { loadInitialCatalogueSnapshot } from "./http_initial.js";
import { startInteractiveHttp } from "./http_interactive.js";
import { handleCatalogueRequest } from "./http_routes.js";
import { closeCatalogueHttp } from "./http_shutdown.js";
import type { RunningServer, ServerOptions } from "./http_types.js";
import { publicChangesStatus, publishCatalogueUpdate } from "./http_update.js";
import { listenOnAvailablePort, listeningPort } from "./ports.js";
import { LivePublicCatalogue } from "./public_catalogue.js";
import type { PublicComparison } from "./public_review.js";
import { VersionedRebuildStatus } from "./rebuild_status_state.js";
import { send } from "./respond.js";
import { ReviewRoutes } from "./review_routes.js";
import {
  livePublicInput,
  removedPagePreviewSource,
  selectedReviewSource,
} from "./review_sources.js";
import type { ChangesStatus } from "./update_messages.js";
import { ServeWorkspaceEligibility } from "./workspace_eligibility.js";

/** Start Browse only after manifest validation succeeds. */
export async function startCatalogueServer(
  config: ResolvedConfig,
  options: ServerOptions,
): Promise<RunningServer> {
  validateInteractiveSources(config, options.componentRuntime);
  const snapshot = await loadInitialCatalogueSnapshot(config, options);
  const validated = catalogueSnapshotForConfig(snapshot, config);
  const changes = validated.changes;
  let catalogue = validated.catalogue;
  let manifest = catalogue.manifest;
  let componentRuntime = options.componentRuntime;
  let controls = componentRuntime
    ? new ComponentRenderService(componentRuntime)
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
  let documents = componentRuntime
    ? createDocuments(componentRuntime)
    : undefined;
  const clientModules = timeSync("server.client-modules", () =>
    loadBrowserClientModules(),
  );
  const navigationModules = timeSync("server.navigation-modules", () =>
    loadBrowserNavigationModules(),
  );
  const fontAssets = timeSync("server.fonts", () => loadShellFontAssets());
  const streams = new Set<ServerResponse>();
  const interactiveState: { server?: InteractiveServer } = {};
  const eligibility = new ServeWorkspaceEligibility(options.onDiagnostic);
  let closing: Promise<void> | undefined;
  const reviewRoutes = options.review
    ? new ReviewRoutes(
        options.review,
        () => selectedReviewSource(manifest, componentChanges),
        (comparison) => {
          if (changesStatus !== "ready") return;
          publicCatalogue.publish(publicInput(comparison), contentVersion);
          publicComparison = comparison;
        },
        () =>
          removedPagePreviewSource(
            activeCatalogue,
            componentChanges,
            changesStatus,
          ),
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
  const rebuildStatus = options.rebuildStatus
    ? new VersionedRebuildStatus(options.rebuildStatus, updateVersion)
    : undefined;
  let publicComparison: PublicComparison | undefined;
  const publicInput = (
    comparison: PublicComparison | undefined = publicComparison,
  ) =>
    livePublicInput(
      activeCatalogue,
      publicChangesStatus(
        options.liveChanges,
        options.review !== undefined,
        changedRoutes,
        componentChanges !== undefined,
        changesStatus,
      ),
      changedRoutes,
      componentChanges,
      comparison,
    );
  const publicCatalogue = new LivePublicCatalogue(
    config,
    publicInput(),
    contentVersion,
  );
  const server = http.createServer((request, response) => {
    if (
      handleComponentHttpRequest(
        request,
        response,
        controls,
        activity,
        options.onDiagnostic,
      )
    )
      return;
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
      interactiveState.server,
      request.headers,
      interactiveState.server && componentRuntime
        ? eligibility.source(componentRuntime)
        : undefined,
      () => rebuildStatus?.current(),
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
  const appPort = listeningPort(server);
  const interactive = await startInteractiveHttp({
    appPort,
    catalogue: activeCatalogue,
    clientModules,
    config,
    ...(documents ? { documents } : {}),
    onFailure: () =>
      closeCatalogueHttp(server, streams, [reviewRoutes, controls, documents])
        .then(() => undefined)
        .catch(() => undefined),
    options,
    ...(componentRuntime ? { runtime: componentRuntime } : {}),
    streams,
  });
  if (interactive) interactiveState.server = interactive;
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
      if (componentRuntime && documents) {
        componentRuntime = { ...componentRuntime, manifest: complete };
        interactive?.replace(componentRuntime, activeCatalogue, documents);
      }
      return true;
    },
    close(): Promise<void> {
      closing ??= closeCatalogueHttp(server, streams, [
        reviewRoutes,
        controls,
        documents,
        interactive,
      ]);
      return closing;
    },
    ...(interactive
      ? {
          interactiveOrigin: interactive.origin,
          interactivePort: interactive.port,
        }
      : {}),
    port: appPort,
    replaceComponentRuntime(runtime): void {
      validateInteractiveSources(config, runtime);
      componentRuntime = runtime;
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
      if (documents) interactive?.replace(runtime, activeCatalogue, documents);
    },
    publishUpdate(update = {}): void {
      const next = publishCatalogueUpdate(
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
        publicCatalogue,
        options.liveChanges,
        options.review !== undefined,
      );
      if (!next) return;
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
      const adoptedStatus = rebuildStatus?.advance(updateVersion);
      if (adoptedStatus) publishRebuildEvent(streams, adoptedStatus);
      const payload = `event: update\ndata: ${updateVersion}\n\n`;
      for (const stream of streams) stream.write(payload);
    },
    ...(rebuildStatus
      ? {
          replaceRebuildStatus(status) {
            const acceptance = rebuildStatus.accept(status, updateVersion);
            if (acceptance === "changed")
              publishRebuildEvent(streams, rebuildStatus.current());
            return acceptance;
          },
        }
      : {}),
    url: `http://127.0.0.1:${appPort}`,
  };
}

function validateInteractiveSources(
  config: ResolvedConfig,
  runtime?: ComponentRuntime,
): void {
  if (!runtime) return;
  const captured = runtime.interactiveSources !== undefined;
  if ((config.interactive === "serve") !== captured)
    throw new MoklyError(
      "server-failed",
      config.interactive === "serve"
        ? "Live runtime is missing its accepted source capture"
        : "non-Live runtime must not retain an interactive source capture",
    );
}

function publishRebuildEvent(
  streams: ReadonlySet<ServerResponse>,
  status: RebuildStatus,
): void {
  const payload = `event: rebuild\ndata: ${JSON.stringify(status)}\n\n`;
  for (const stream of streams) stream.write(payload);
}
