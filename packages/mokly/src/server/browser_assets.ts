/** Package-owned browser modules, font responses, and live-update streams. */

import type { ServerResponse } from "node:http";

import { send } from "./respond.js";

/** In-memory package assets served by one Browse child. */
export interface ServedAssets {
  clientModules: ReadonlyMap<string, Buffer>;
  fontAssets: ReadonlyMap<string, Buffer>;
  navigationModules: ReadonlyMap<string, Buffer>;
}

/** Serve one allowlisted JavaScript module. */
export function serveClientModule(
  response: ServerResponse,
  filename: string,
  modules: ReadonlyMap<string, Buffer>,
  method: string,
): void {
  const content = modules.get(filename);
  if (!content) return send(response, 404, "text/plain", "Not found", method);
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": "text/javascript; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(method === "HEAD" ? undefined : content);
}

/** Serve one allowlisted packaged font asset. */
export function serveFontAsset(
  response: ServerResponse,
  filename: string,
  fonts: ReadonlyMap<string, Buffer>,
  method: string,
): void {
  const content = fonts.get(filename);
  if (!content) return send(response, 404, "text/plain", "Not found", method);
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": filename.endsWith(".woff2")
      ? "font/woff2"
      : "text/plain; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(method === "HEAD" ? undefined : content);
}

/** Open the versioned server-sent event stream used by watched Browse. */
export function openEventStream(
  response: ServerResponse,
  streams: Set<ServerResponse>,
  version: number,
  method: string,
): void {
  response.writeHead(200, {
    "cache-control": "no-cache",
    connection: "keep-alive",
    "content-type": "text/event-stream",
  });
  if (method === "HEAD") {
    response.end();
    return;
  }
  response.write(`event: ready\ndata: ${version}\n\n`);
  streams.add(response);
  response.on("close", () => streams.delete(response));
}
