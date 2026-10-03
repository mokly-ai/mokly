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
import { ComponentChangeCache } from "./component_change_cache.js";
import { ComponentRenderService } from "./controls/service.js";
import { ForegroundActivity } from "./demand/activity.js";
import { DocumentService } from "./demand/service.js";
import {
  acceptedGeneratedStatic,
  initialGeneratedStatic,
} from "./generated_static.js";
import { catalogueRequestHandler } from "./http_request_handler.js";
import { closeCatalogueHttp } from "./http_shutdown.js";
import type { RunningServer, ServerOptions } from "./http_types.js";
import { listenOnAvailablePort } from "./ports.js";
import { LivePublicCatalogue } from "./public_catalogue.js";
import type { PublicComparison } from "./public_review.js";
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
  let acceptedGenerated = await initialGeneratedStatic(
    config,
    options.componentRuntime,
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
  let changedEntries =
    changes?.changedEntries ??
    options.changedEntries ??
    componentChanges?.changedEntries;
  let changesStatus: ChangesStatus =
    options.changesStatus ??
    (changedEntries || componentChanges ? "ready" : "unavailable");
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
    !hasEvidence &&
    options.changesStatus !== "unavailable"
      ? ("disabled" as const)
      : status;
  const publicInput = (
    comparison: PublicComparison | undefined = publicComparison,
  ) =>
    livePublicInput(
      activeCatalogue,
      publicChangesStatus(
        changedEntries,
        componentChanges !== undefined,
        changesStatus,
      ),
      changedEntries,
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
      changedEntries: () => changedEntries,
      changesStatus: () => changesStatus,
      componentChanges: () => componentChanges,
      config,
      contentVersion: () => contentVersion,
      controls: () => controls,
      documents: () => documents,
      options,
      publicCatalogue,
      reviewRoutes,
      streams,
      updateVersion: () => updateVersion,
    }),
  );
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
          changedEntries,
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
            next.changedEntries,
            next.componentChanges !== undefined,
            next.changesStatus,
          ),
          next.changedEntries,
          next.componentChanges,
          undefined,
        ),
        next.contentVersion,
        update.kind === "evidence",
      );
      ({
        activeCatalogue,
        changedEntries,
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
