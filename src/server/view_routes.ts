import type { ServerResponse } from "node:http";

import {
  encodeUrlPath,
  isHistoricalSnapshotId,
  resolveCatalogueRoute,
} from "@mokly/viewer/data";
import { catalogueRouteEntry } from "@mokly/viewer/server";
import type { Catalogue, ShellContext } from "@mokly/viewer/server";

import type { ResolvedConfig } from "../config/types.js";

import type { DocumentService } from "./demand/service.js";
import { requestedFragment, withFragmentQuery } from "./fragments.js";
import { notFoundPage, viewPage } from "./pages.js";
import { safeDecode, safeDecodePath, send } from "./respond.js";

export async function redirectId(
  response: ServerResponse,
  url: URL,
  encodedId: string,
  catalogue: Catalogue,
  config: ResolvedConfig,
  context: ShellContext,
  method: string,
  documents?: DocumentService,
): Promise<void> {
  if (url.searchParams.has("snapshot"))
    return send(
      response,
      400,
      "text/plain",
      "This version is unavailable. Open it from Changes.",
      method,
    );
  const entry = catalogue.byId.get(safeDecode(encodedId));
  if (!entry || entry.kind === "collection")
    return send(
      response,
      404,
      "text/html",
      notFoundPage(encodedId, catalogue, context),
      method,
    );
  const fragment = await requestedFragment(
    url,
    entry,
    catalogue,
    config,
    documents,
  );
  if (fragment === null) {
    return send(response, 400, "text/plain", "Invalid fragment query", method);
  }
  const selected = context.readModel
    ? resolveCatalogueRoute(context.readModel, entry.route)
    : undefined;
  const location = new URL(
    withFragmentQuery(`/view/${encodeUrlPath(entry.route)}`, fragment),
    "https://mokly.invalid",
  );
  if (selected?.snapshotId)
    location.searchParams.set("snapshot", selected.snapshotId);
  response.writeHead(302, {
    location: `${location.pathname}${location.search}`,
  });
  response.end();
}

export async function renderView(
  response: ServerResponse,
  url: URL,
  encodedRoute: string,
  catalogue: Catalogue,
  config: ResolvedConfig,
  context: ShellContext,
  method: string,
  documents?: DocumentService,
): Promise<void> {
  const route = safeDecodePath(encodedRoute);
  const snapshots = url.searchParams.getAll("snapshot");
  const requestedSnapshot = snapshots.length === 1 ? snapshots[0] : undefined;
  if (
    snapshots.length > 1 ||
    (requestedSnapshot !== undefined &&
      !isHistoricalSnapshotId(requestedSnapshot))
  )
    return send(
      response,
      400,
      "text/plain",
      "This version is unavailable.",
      method,
    );
  const selected =
    route && context.readModel
      ? resolveCatalogueRoute(context.readModel, route, requestedSnapshot)
      : undefined;
  const entry = route
    ? context.readModel
      ? selected
        ? catalogueRouteEntry(catalogue, selected.entry.route)
        : undefined
      : requestedSnapshot === undefined
        ? catalogueRouteEntry(catalogue, route)
        : undefined
    : undefined;
  if (!entry)
    return send(
      response,
      404,
      "text/html",
      notFoundPage(encodedRoute, catalogue, context),
      method,
    );
  const manifestEntry = "kind" in entry ? entry : undefined;
  const removed = catalogue.removedEntries.some(
    ({ entry }) => entry.route === route,
  );
  const fragment = removed
    ? url.searchParams.has("fragment")
      ? null
      : undefined
    : await requestedFragment(url, manifestEntry, catalogue, config, documents);
  if (fragment === null) {
    return send(response, 400, "text/plain", "Invalid fragment query", method);
  }
  const viewContext = {
    ...context,
    ...(route ? { activeRoute: route } : {}),
    ...(fragment ? { fragment } : {}),
    ...(selected?.snapshotId ? { snapshotId: selected.snapshotId } : {}),
  };
  return send(
    response,
    200,
    "text/html",
    viewPage(entry, catalogue, viewContext),
    method,
  );
}
