import type { ServerResponse } from "node:http";

import { encodeUrlPath } from "@mokly/viewer/data";
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
  generatedOutputs?: ReadonlyMap<string, string>,
): Promise<void> {
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
    documents,
    generatedOutputs,
  );
  if (fragment === null) {
    return send(response, 400, "text/plain", "Invalid fragment query", method);
  }
  response.writeHead(302, {
    location: withFragmentQuery(
      `/view/${encodeUrlPath(entry.route)}`,
      fragment,
    ),
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
  generatedOutputs?: ReadonlyMap<string, string>,
): Promise<void> {
  const route = safeDecodePath(encodedRoute);
  const entry = route ? catalogueRouteEntry(catalogue, route) : undefined;
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
    : await requestedFragment(
        url,
        manifestEntry,
        catalogue,
        documents,
        generatedOutputs,
      );
  if (fragment === null) {
    return send(response, 400, "text/plain", "Invalid fragment query", method);
  }
  const viewContext = {
    ...context,
    ...(route ? { activeRoute: route } : {}),
    ...(fragment ? { fragment } : {}),
  };
  return send(
    response,
    200,
    "text/html",
    viewPage(entry, catalogue, viewContext),
    method,
  );
}
