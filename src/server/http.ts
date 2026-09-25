import fs from "node:fs";
import http, { type ServerResponse } from "node:http";
import path from "node:path";

import { createCatalogue } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { GeneratedFile } from "../build/generated_file.js";
import { loadConsumerGraph } from "../build/load_graph.js";
import { GENERATED_DIRECTORY } from "../build/styles/routes.js";
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
import { acceptedGeneratedStatic } from "./generated_static.js";
import { handleCatalogueRequest } from "./http_routes.js";
import { closeCatalogueHttp } from "./http_shutdown.js";
import type { RunningServer, ServerOptions } from "./http_types.js";
import { listenOnAvailablePort } from "./ports.js";
import { LivePublicCatalogue } from "./public_catalogue.js";
import type { PublicComparison } from "./public_review.js";
import { send } from "./respond.js";
import { ReviewRoutes } from "./review_routes.js";
import {
  livePublicInput,
  removedPagePreviewSource,
  selectedReviewSource,
} from "./review_sources.js";
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
  const expectedGenerated =
    !options.componentRuntime &&
    config.generatedOutput === "committed" &&
    fs.existsSync(path.join(config.mockupsDir, GENERATED_DIRECTORY))
      ? new Set((await loadConsumerGraph(config, false)).styleOutputs.keys())
      : new Set<string>();
  let acceptedGenerated: ReadonlyMap<string, GeneratedFile> =
    acceptedGeneratedStatic(
      config,
      options.componentRuntime,
      expectedGenerated,
    );
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
  let publicComparison: PublicComparison | undefined;
  const publicChangesStatus = (
    routes: readonly string[] | undefined,
    hasEvidence: boolean,
    status: ChangesStatus,
  ) =>
    options.liveChanges === false &&
    !options.review &&
    routes === undefined &&
    !hasEvidence
      ? ("disabled" as const)
      : status;
  const publicInput = (
    comparison: PublicComparison | undefined = publicComparison,
  ) =>
    livePublicInput(
      activeCatalogue,
      publicChangesStatus(
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
      void handleControls(
        request,
        response,
        controls,
        options.onDiagnostic,
      ).finally(() => busy(false));
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
      acceptedGenerated,
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
        livePublicInput(
          next.activeCatalogue,
          publicChangesStatus(
            next.changedRoutes,
            next.componentChanges !== undefined,
            next.changesStatus,
          ),
          next.changedRoutes,
          next.componentChanges,
          undefined,
        ),
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
