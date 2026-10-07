/** Generated views are rendered in memory; ordinary public files retain the static policy. */

import type { ServerResponse } from "node:http";

import { VIEWER_DIRECTORY, GENERATED_DIRECTORY } from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../../browse/document_adapter.js";
import { generatedBytes } from "../../build/generated_file.js";
import { isGeneratedRoute } from "../../build/styles/routes.js";
import { errorMessage } from "../../errors.js";
import { contentType, safeDecodePath, send } from "../respond.js";

import type { DocumentService } from "./service.js";

export async function handleDemandRequest(
  url: URL,
  method: string,
  response: ServerResponse,
  catalogue: Catalogue,
  documents: DocumentService,
): Promise<boolean> {
  const metadata = url.pathname.startsWith(`/${VIEWER_DIRECTORY}/views/`);
  if (!metadata && !url.pathname.startsWith("/static/")) return false;
  const raw = safeDecodePath(
    url.pathname.slice(metadata ? `/${VIEWER_DIRECTORY}/views/`.length : 8),
  );
  const route = metadata
    ? raw
    : raw?.startsWith(`${GENERATED_DIRECTORY}/`)
      ? raw.slice(GENERATED_DIRECTORY.length + 1)
      : undefined;
  if (
    !route ||
    (!documents.routes.has(route) && (metadata || !documents.styles.has(route)))
  )
    if (!metadata && raw && isGeneratedRoute(raw)) {
      send(response, 404, "text/plain", "Not found", method);
      return true;
    } else return false;
  if (method !== "GET" && method !== "HEAD") {
    send(response, 405, "text/plain", "Method not allowed", method);
    return true;
  }
  try {
    const style = metadata ? undefined : documents.styles.get(route);
    if (style !== undefined) {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": contentType(route),
        "x-content-type-options": "nosniff",
      });
      response.end(method === "HEAD" ? undefined : generatedBytes(style));
      return true;
    }
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
