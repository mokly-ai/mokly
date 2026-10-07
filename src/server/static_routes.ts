/** Public `/static/` delivery with Browse-only HTML authentication. */

import type { ServerResponse } from "node:http";
import path from "node:path";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../browse/document_adapter.js";
import { generatedBytes, type GeneratedFile } from "../build/generated_file.js";
import { PublicFilePolicy } from "../config/public_policy.js";
import type { ResolvedConfig } from "../config/types.js";
import { errorMessage } from "../errors.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

import { contentType, safeDecodePath, send } from "./respond.js";

/** Serve one confined public file, adapting every HTML response for Browse. */
export function serveStatic(
  response: ServerResponse,
  encodedPath: string,
  config: ResolvedConfig,
  catalogue: Catalogue,
  method: string,
  generatedOutputs?: ReadonlyMap<string, GeneratedFile>,
  assetClosure?: ReadonlySet<string>,
): void {
  const relative = safeDecodePath(encodedPath);
  if (!relative) {
    return send(response, 400, "text/plain", "Invalid static path", method);
  }
  const generatedRoute = relative.startsWith(`${GENERATED_DIRECTORY}/`)
    ? relative.slice(GENERATED_DIRECTORY.length + 1)
    : undefined;
  if (generatedRoute === MANIFEST_NAME)
    return send(response, 404, "text/plain", "Not found", method);
  const generated =
    generatedRoute === undefined
      ? undefined
      : generatedOutputs?.get(generatedRoute);
  if (generatedRoute !== undefined && generated === undefined)
    return send(response, 404, "text/plain", "Not found", method);
  if (
    generatedRoute === undefined &&
    !(
      assetClosure ??
      new Set(
        "assetClosure" in catalogue.manifest
          ? catalogue.manifest.assetClosure
          : [],
      )
    ).has(relative)
  )
    return send(response, 404, "text/plain", "Not found", method);
  const candidate = path.resolve(config.mockupsDir, relative);
  const content =
    generated === undefined
      ? new PublicFilePolicy(config).read(relative)
      : generatedBytes(generated);
  if (!content) return send(response, 404, "text/plain", "Not found", method);
  const type = contentType(candidate);
  let body: Buffer | string = content;
  if (type.startsWith("text/html")) {
    try {
      body = adaptBrowseDocument(
        content.toString("utf8"),
        generatedRoute,
        catalogue,
      );
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
