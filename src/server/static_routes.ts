/** Public `/static/` delivery with Browse-only HTML authentication. */

import fs from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";

import type { Catalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../browse/document_adapter.js";
import { generatedBytes, type GeneratedFile } from "../build/generated_file.js";
import { isOwned } from "../build/ownership.js";
import { isGeneratedRoute } from "../build/styles/routes.js";
import { publicFileLocation } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { errorMessage } from "../errors.js";

import { contentType, safeDecodePath, send } from "./respond.js";

/** Serve one confined public file, adapting every HTML response for Browse. */
export function serveStatic(
  response: ServerResponse,
  encodedPath: string,
  config: ResolvedConfig,
  catalogue: Catalogue,
  method: string,
  acceptedGenerated: ReadonlyMap<string, GeneratedFile> = new Map(),
): void {
  const relative = safeDecodePath(encodedPath);
  if (!relative) {
    return send(response, 400, "text/plain", "Invalid static path", method);
  }
  const candidate = path.resolve(config.mockupsDir, relative);
  if (isGeneratedRoute(relative)) {
    const content = acceptedGenerated.get(relative);
    if (content === undefined)
      return send(response, 404, "text/plain", "Not found", method);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentType(relative),
      "x-content-type-options": "nosniff",
    });
    response.end(method === "HEAD" ? undefined : generatedBytes(content));
    return;
  }
  if (
    catalogue.manifest.schemaVersion === "live-index-1" &&
    isOwned(candidate, config)
  )
    return send(response, 404, "text/plain", "Not found", method);
  const location = publicFileLocation(candidate, config);
  if (!location) {
    return send(response, 404, "text/plain", "Not found", method);
  }
  let content: Buffer;
  try {
    content = fs.readFileSync(location.physicalPath);
  } catch {
    return send(response, 404, "text/plain", "Not found", method);
  }
  const type = contentType(candidate);
  let body: Buffer | string = content;
  if (type.startsWith("text/html")) {
    try {
      body = adaptBrowseDocument(content.toString("utf8"), relative, catalogue);
    } catch (error) {
      return send(
        response,
        500,
        "text/plain",
        `Could not prepare preview document: ${errorMessage(error)}`,
        method,
      );
    }
  }
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": type,
    "x-content-type-options": "nosniff",
  });
  response.end(method === "HEAD" ? undefined : body);
}
