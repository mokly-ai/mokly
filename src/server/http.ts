import http, { type ServerResponse } from "node:http";

import { createCatalogue } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { GeneratedFile } from "../build/generated_file.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import { parseManifest } from "../registry/manifest.js";
import { includeMovedEntries } from "../review/moves/entries.js";

import { catalogueWithChanges } from "./baseline_catalogue.js";
import { catalogueSnapshotForConfig } from "./catalogue_snapshot.js";
import { advanceCatalogueState } from "./catalogue_update.js";
import { loadServeBrowserAssets } from "./client_modules.js";
import { ComponentChangeCache } from "./component_change_cache.js";
import { ComponentRenderService } from "./controls/service.js";
import { ForegroundActivity } from "./demand/activity.js";
import { DocumentService } from "./demand/service.js";
import { acceptedGeneratedStatic } from "./generated_static.js";
import { catalogueRequestHandler } from "./http_request_handler.js";
import { closeCatalogueHttp } from "./http_shutdown.js";
import { initialHttpSnapshot } from "./http_snapshot.js";
import type { RunningServer, ServerOptions } from "./http_types.js";
import { listenOnAvailablePort } from "./ports.js";
import { LivePublicCatalogue } from "./public_catalogue.js";
import type { PublicComparison } from "./public_review.js";
import { RenderMoveTargets } from "./render_moves.js";
import { ReviewRoutes } from "./review_routes.js";
import {
  livePublicInput,
  removedPagePreviewSource,
  selectedReviewSource,
} from "./review_sources.js";
import { ServedClosure } from "./served_closure.js";
import type { ChangesStatus } from "./update_messages.js";

/** Start Browse only after manifest validation succeeds. */
export async function startCatalogueServer(
  config: ResolvedConfig,
  options: ServerOptions,
): Promise<RunningServer> {
  const snapshot = await initialHttpSnapshot(config, options);
  const validated = catalogueSnapshotForConfig(snapshot, config);
  const changes = validated.changes;
  let catalogue = validated.catalogue;
  let manifest = catalogue.manifest;
  const assetClosure = new ServedClosure(
    options.assetClosure ??
      ("assetClosure" in manifest ? manifest.assetClosure : []),
  );
  let acceptedGenerated: ReadonlyMap<string, GeneratedFile> =
    options.generatedOutputs ??
    snapshot.outputs ??
    acceptedGeneratedStatic(options.componentRuntime);
  const movedLinks = new RenderMoveTargets();
  let controls = options.componentRuntime
    ? new ComponentRenderService(options.componentRuntime, movedLinks.read)
    : undefined;
  const activity = new ForegroundActivity(options.onForeground ?? (() => {}));
  const createDocuments = (runtime: ComponentRuntime) =>
    runtime.manifest.schemaVersion === "live-index-2"
      ? new DocumentService(runtime, activity.channel(), {
          moveTargets: movedLinks.read,
          onDocument: (document) => {
            if (document.assetClosure)
              assetClosure.visit(document.assetClosure);
            if (runtime.generation === controls?.capability().generation)
              publicCatalogue.acceptDocument(
                document,
                publicInput(),
                contentVersion,
              );
            options.onPreviewResources?.({
              generation: runtime.generation,
              ...(document.resourceSeeds
                ? { resourceSeeds: document.resourceSeeds }
                : {}),
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
  const { clientModules, navigationModules, fontAssets } =
    loadServeBrowserAssets();
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
    ? catalogueWithChanges(manifest, componentChanges)
    : catalogue;
  let changedEntries =
    changes?.changedEntries ??
    options.changedEntries ??
    componentChanges?.changedEntries;
  changedEntries = includeMovedEntries(
    changedEntries,
    componentChanges?.pairing?.moves,
  );
  let changesStatus: ChangesStatus =
    options.changesStatus ??
    (changedEntries || componentChanges ? "ready" : "unavailable");
  movedLinks.accept(controls, componentChanges, changesStatus);
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
      assetClosure: () => assetClosure.current,
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
    completeCatalogue(complete, generation, checked): boolean {
      if (controls?.capability().generation !== generation) return false;
      parseManifest(complete);
      const nextCatalogue = createCatalogue(complete);
      const nextActive = componentChanges
        ? catalogueWithChanges(complete, componentChanges)
        : nextCatalogue;
      publicCatalogue.publish(
        { ...publicInput(), catalogue: nextActive },
        contentVersion,
      );
      manifest = complete;
      assetClosure.accept(checked ?? complete.assetClosure);
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
      movedLinks.clear();
      acceptedGenerated = acceptedGeneratedStatic(runtime);
      publicCatalogue.clearUsage();
      assetClosure.advance(
        "assetClosure" in runtime.manifest
          ? runtime.manifest.assetClosure
          : undefined,
      );
      void documents?.close();
      documents = createDocuments(runtime);
      if (runtime.manifest.schemaVersion === "live-index-2") {
        manifest = runtime.manifest;
        catalogue = createCatalogue(manifest);
        activeCatalogue = catalogue;
      }
      if (controls) controls.replace(runtime);
      else controls = new ComponentRenderService(runtime, movedLinks.read);
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
      if (Object.hasOwn(update, "componentChanges"))
        movedLinks.accept(controls, componentChanges, changesStatus);
      else if (changesStatus !== "ready") movedLinks.clear();
      reviewRoutes?.invalidate();
      publicComparison = undefined;
      const payload = `event: update\ndata: ${updateVersion}\n\n`;
      for (const stream of streams) stream.write(payload);
    },
    url: `http://127.0.0.1:${address.port}`,
  };
}
