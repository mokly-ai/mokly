import type { IncomingMessage, ServerResponse } from "node:http";

import type { Catalogue } from "@mokly/viewer/server";

import type { GeneratedFile } from "../build/generated_file.js";
import type { ResolvedConfig } from "../config/types.js";

import type { ServedAssets } from "./browser_assets.js";
import type { ComponentChangeSnapshot } from "./component_changes.js";
import { handleControls, localHost } from "./controls/http.js";
import type { ComponentRenderService } from "./controls/service.js";
import type { ForegroundActivity } from "./demand/activity.js";
import type { DocumentService } from "./demand/service.js";
import { handleCatalogueRequest } from "./http_routes.js";
import type { ServerOptions } from "./http_types.js";
import type { LivePublicCatalogue } from "./public_catalogue.js";
import { send } from "./respond.js";
import type { ReviewRoutes } from "./review_routes.js";
import type { ChangesStatus } from "./update_messages.js";

/** One request's immutable view of the accepted server generation. */
export interface HttpDispatchState {
  readonly controls: ComponentRenderService | undefined;
  readonly activity: ForegroundActivity;
  readonly options: ServerOptions;
  readonly catalogue: Catalogue;
  readonly config: ResolvedConfig;
  readonly changedRoutes: readonly string[] | undefined;
  readonly streams: Set<ServerResponse>;
  readonly assets: ServedAssets;
  readonly updateVersion: number;
  readonly reviewRoutes: ReviewRoutes | undefined;
  readonly componentChanges: ComponentChangeSnapshot | undefined;
  readonly documents: DocumentService | undefined;
  readonly changesStatus: ChangesStatus;
  readonly contentVersion: number;
  readonly publicCatalogue: LivePublicCatalogue;
  readonly acceptedGenerated: ReadonlyMap<string, GeneratedFile>;
}

/** Route HTTP work without letting a failed request tear down the listener. */
export function dispatchHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: HttpDispatchState,
): void {
  const { controls, activity, options } = state;
  if (controls && !localHost(request)) {
    send(
      response,
      403,
      "text/plain",
      "This request is not allowed.",
      request.method ?? "GET",
    );
    return;
  }
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
  void handleCatalogueRequest(
    request.url ?? "/",
    request.method ?? "GET",
    response,
    state.catalogue,
    state.config,
    options.base,
    () => state.changedRoutes,
    state.streams,
    state.assets,
    () => state.updateVersion,
    state.reviewRoutes,
    state.componentChanges,
    controls?.capability(),
    state.documents,
    options.liveChanges === false ? undefined : state.changesStatus,
    state.contentVersion,
    state.publicCatalogue,
    state.acceptedGenerated,
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
}
