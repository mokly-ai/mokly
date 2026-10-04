import http, { type ServerResponse } from "node:http";

import { createCatalogue } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import type { InteractiveServer } from "../interactive/server.js";
import { parseManifest } from "../registry/manifest.js";

import { catalogueAtBaseline } from "./baseline_catalogue.js";
import { loadCatalogueAssets } from "./client_modules.js";
import { ComponentChangeCache } from "./component_change_cache.js";
import { ComponentRenderService } from "./controls/service.js";
import { ForegroundActivity } from "./demand/activity.js";
import { DocumentService } from "./demand/service.js";
import {
  acceptedGeneratedStatic,
  initialGeneratedStatic,
} from "./generated_static.js";
import { loadInitialCatalogueSnapshot } from "./http_initial.js";
import {
  startInteractiveHttp,
  validateInteractiveSources,
} from "./http_interactive.js";
import { catalogueRequestHandler } from "./http_request_handler.js";
import { closeCatalogueHttp } from "./http_shutdown.js";
import type { RunningServer, ServerOptions } from "./http_types.js";
import { publicChangesStatus, publishCatalogueUpdate } from "./http_update.js";
import { listenOnAvailablePort, listeningPort } from "./ports.js";
import { LivePublicCatalogue } from "./public_catalogue.js";
import type { PublicComparison } from "./public_review.js";
import {
  publishRebuildEvent,
  VersionedRebuildStatus,
} from "./rebuild_status_state.js";
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
  options = { ...options };
  validateInteractiveSources(config, options.componentRuntime);
  const snapshot = await loadInitialCatalogueSnapshot(config, options);
  const changes = snapshot.changes;
  let catalogue = snapshot.catalogue;
  let manifest = catalogue.manifest;
  let componentRuntime = options.componentRuntime;
  let acceptedGenerated = await initialGeneratedStatic(
    config,
    componentRuntime,
  );
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
  const { clientModules, navigationModules, fontAssets } =
    loadCatalogueAssets();
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
  let changedIds =
    changes?.changedIds ?? options.changedIds ?? componentChanges?.changedIds;
  let changesStatus: ChangesStatus =
    options.changesStatus ??
    (changedIds || componentChanges ? "ready" : "unavailable");
  let updateVersion = options.updateVersion ?? 1;
  let contentVersion = updateVersion;
  const rebuildStatus = options.rebuildStatus
    ? new VersionedRebuildStatus(options.rebuildStatus, updateVersion)
    : undefined;
  let publicComparison: PublicComparison | undefined;
  const preserveUnavailable = options.changesStatus === "unavailable";
  const publicInput = (
    comparison: PublicComparison | undefined = publicComparison,
  ) =>
    livePublicInput(
      activeCatalogue,
      publicChangesStatus(
        options.liveChanges,
        options.review !== undefined,
        changedIds,
        componentChanges !== undefined,
        changesStatus,
        preserveUnavailable,
      ),
      changedIds,
      componentChanges,
      comparison,
    );
  const publicCatalogue = new LivePublicCatalogue(
    config,
    publicInput(),
    contentVersion,
  );
  const server = http.createServer(
    catalogueRequestHandler({
      activity,
      activeCatalogue: () => activeCatalogue,
      assets: { clientModules, fontAssets, navigationModules },
      acceptedGenerated: () => acceptedGenerated,
      changedIds: () => changedIds,
      changesStatus: () => changesStatus,
      componentChanges: () => componentChanges,
      config,
      contentVersion: () => contentVersion,
      controls: () => controls,
      documents: () => documents,
      interactive: () => interactiveState.server,
      options,
      publicCatalogue,
      rebuildStatus: () => rebuildStatus?.current(),
      reviewRoutes,
      streams,
      updateVersion: () => updateVersion,
      workspaceEligibility: () =>
        interactiveState.server && componentRuntime
          ? eligibility.source(componentRuntime)
          : undefined,
    }),
  );
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
      acceptedGenerated = acceptedGeneratedStatic(config, runtime);
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
          changedIds,
          componentChanges,
          changesStatus,
          updateVersion,
          contentVersion,
        },
        update,
        publicCatalogue,
        options.liveChanges,
        options.review !== undefined,
        preserveUnavailable,
      );
      if (!next) return;
      ({
        activeCatalogue,
        changedIds,
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
