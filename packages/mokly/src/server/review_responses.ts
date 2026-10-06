/** HTTP response helpers for served Review artifacts. */

import type { ServerResponse } from "node:http";
import path from "node:path";

import { errorMessage } from "../errors.js";

import { readConfinedFile } from "./confined_file.js";
import { contentType, send } from "./respond.js";

/** Redirect to a stable or immutable Review route without caching. */
export function redirectReview(
  response: ServerResponse,
  location: string,
): void {
  response.writeHead(302, {
    "cache-control": "no-store",
    location,
  });
  response.end();
}

/** Serve one immutable Review artifact file from its retained generation. */
export function serveReviewArtifactFile(
  directory: string,
  relative: string,
  response: ServerResponse,
  method: string,
): void {
  const content = readConfinedFile(directory, relative);
  if (content === undefined)
    return send(response, 404, "text/plain", "Not found", method);
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": contentType(path.resolve(directory, relative)),
    "x-content-type-options": "nosniff",
  });
  response.end(method === "HEAD" ? undefined : content);
}

/** Comparison failures stay inside the current screen and offer a retry. */
export function sendReviewFailure(
  response: ServerResponse,
  error: unknown,
  base: string,
  method: string,
): void {
  response.writeHead(500, {
    "cache-control": "no-store",
    "content-type": "application/json",
    "x-content-type-options": "nosniff",
  });
  response.end(
    method === "HEAD"
      ? undefined
      : JSON.stringify({
          error: "The comparison could not be loaded. Try again.",
          details: `Comparison with ${base}: ${errorMessage(error)}`,
        }),
  );
}
