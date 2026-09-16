/** Generated views are rendered in memory; ordinary public files retain the static policy. */
import type { ServerResponse } from "node:http";

import type { Catalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../../browse/document_adapter.js";
import { errorMessage } from "../../errors.js";
import { safeDecodePath, send } from "../respond.js";

import type { DocumentService } from "./service.js";

export async function handleDemandRequest(
  url: URL,
  method: string,
  response: ServerResponse,
  catalogue: Catalogue,
  documents: DocumentService,
): Promise<boolean> {
  const metadata = url.pathname.startsWith("/__mokly/views/");
  if (!metadata && !url.pathname.startsWith("/static/")) return false;
  const route = safeDecodePath(
    url.pathname.slice(metadata ? "/__mokly/views/".length : 8),
  );
  if (!route || !documents.routes.has(route)) return false;
  if (method !== "GET" && method !== "HEAD") {
    send(response, 405, "text/plain", "Method not allowed", method);
    return true;
  }
  try {
    if (
      metadata &&
      url.searchParams.get("generation") !== documents.generation
    ) {
      send(
        response,
        409,
        "text/plain",
        "The catalogue changed. Reload to continue.",
        method,
      );
      return true;
    }
    const document = await documents.read(route);
    response.setHeader("cache-control", "no-store");
    response.setHeader("x-content-type-options", "nosniff");
    send(
      response,
      200,
      metadata ? "application/json" : "text/html",
      metadata
        ? JSON.stringify({
            route,
            generation: documents.generation,
            ...(document.view ? { usage: document.view } : {}),
          })
        : adaptBrowseDocument(document.html, route, catalogue),
      method,
    );
  } catch (error) {
    if (!response.destroyed)
      send(
        response,
        500,
        "text/plain",
        `Could not prepare preview document: ${errorMessage(error)}`,
        method,
      );
  }
  return true;
}
