import type { RequestListener } from "node:http";

import type { ResolvedConfig } from "../config/types.js";
import type { InteractiveServer } from "../interactive/server.js";

import { handleControls, localHost } from "./controls/http.js";
import type { ComponentRenderService } from "./controls/service.js";
import type { ForegroundActivity } from "./demand/activity.js";
import type { DocumentService } from "./demand/service.js";
import { handleCatalogueRequest } from "./http_routes.js";
import type { ServerOptions } from "./http_types.js";
import { send } from "./respond.js";
import type { ChangesStatus } from "./update_messages.js";
import type { WorkspaceEligibilitySource } from "./workspace_eligibility.js";

type CatalogueRequestArguments = Parameters<typeof handleCatalogueRequest>;

interface CatalogueRequestHandlerInput {
  activity: ForegroundActivity;
  activeCatalogue(): CatalogueRequestArguments[3];
  assets: CatalogueRequestArguments[8];
  changedIds(): readonly string[] | undefined;
  changesStatus(): ChangesStatus;
  componentChanges(): CatalogueRequestArguments[11];
  config: ResolvedConfig;
  contentVersion(): number;
  controls(): ComponentRenderService | undefined;
  documents(): DocumentService | undefined;
  interactive(): InteractiveServer | undefined;
  options: ServerOptions;
  publicCatalogue: CatalogueRequestArguments[16];
  rebuildStatus(): ReturnType<NonNullable<CatalogueRequestArguments[20]>>;
  reviewRoutes: CatalogueRequestArguments[10];
  streams: CatalogueRequestArguments[7];
  updateVersion(): number;
  workspaceEligibility(): WorkspaceEligibilitySource | undefined;
}

/** Route one HTTP request against the server's current mutable snapshot. */
export function catalogueRequestHandler(
  input: CatalogueRequestHandlerInput,
): RequestListener {
  return (request, response) => {
    const controls = input.controls();
    if (controls && !localHost(request))
      return send(
        response,
        403,
        "text/plain",
        "This request is not allowed.",
        request.method ?? "GET",
      );
    if (controls && request.url?.startsWith("/__mokly/components/")) {
      const busy = input.activity.channel();
      busy(true);
      void handleControls(
        request,
        response,
        controls,
        input.options.onDiagnostic,
      ).finally(() => busy(false));
      return;
    }
    const requestedVersion = input.updateVersion();
    const requestedChanges = input.changedIds();
    void handleCatalogueRequest(
      request.url ?? "/",
      request.method ?? "GET",
      response,
      input.activeCatalogue(),
      input.config,
      input.options.base,
      () => requestedChanges,
      input.streams,
      input.assets,
      () => requestedVersion,
      input.reviewRoutes,
      input.componentChanges(),
      controls?.capability(),
      input.documents(),
      input.options.liveChanges === false &&
        input.options.changesStatus !== "unavailable"
        ? undefined
        : input.changesStatus(),
      input.contentVersion(),
      input.publicCatalogue,
      input.interactive(),
      request.headers,
      input.workspaceEligibility(),
      input.rebuildStatus,
      input.options.liveChanges === false &&
        input.options.changesStatus === "unavailable",
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
  };
}
