/** Shared HTTP response and safe-path helpers for served Mokly routes. */

import type { ServerResponse } from "node:http";
import path from "node:path";

import { ASSET_MIME_TYPES } from "../build/styles/routes.js";

/** Write one complete text response, omitting the body for HEAD. */
export function send(
  response: ServerResponse,
  status: number,
  type: string,
  body: string,
  method: string,
): void {
  response.writeHead(status, {
    "content-type": `${type}; charset=utf-8`,
    "x-content-type-options": "nosniff",
  });
  response.end(method === "HEAD" ? undefined : body);
}

/** Decode an encoded relative URL path, rejecting traversal and separators. */
export function safeDecodePath(value: string): string | undefined {
  try {
    const segments = value.split("/").map(decodeURIComponent);
    if (
      segments.some(
        (part) =>
          part === "" ||
          part === "." ||
          part === ".." ||
          part.includes("/") ||
          part.includes("\\"),
      )
    )
      return undefined;
    return segments.join("/");
  } catch {
    return undefined;
  }
}

/** Decode one URL component, treating malformed input as empty. */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

/** The response content type for a served artifact or static file. */
export function contentType(candidate: string): string {
  const extension = path.extname(candidate).toLowerCase();
  if (extension === ".json") return "application/json; charset=utf-8";
  const assetType = ASSET_MIME_TYPES.get(extension);
  if (assetType) return assetType;
  return extension === ".html" || extension === ".htm"
    ? "text/html; charset=utf-8"
    : extension === ".js"
      ? "text/javascript; charset=utf-8"
      : extension === ".css"
        ? "text/css; charset=utf-8"
        : "application/octet-stream";
}
