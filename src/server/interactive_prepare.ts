/** Private same-origin trigger for one current-generation Live bundle. */

import type { IncomingHttpHeaders, ServerResponse } from "node:http";

import {
  interactiveHeaders,
  sendInteractive,
  sendInteractiveState,
} from "../interactive/responses.js";
import type { InteractiveServer } from "../interactive/server.js";

import { localHost } from "./controls/http.js";

const PREPARE_PATH = /^\/__mokly\/interactive\/([a-f0-9]{32})\/prepare$/;

/** Handle the private preparation route without exposing it on the Live origin. */
export async function handleInteractivePreparation(
  url: URL,
  method: string,
  response: ServerResponse,
  headers: IncomingHttpHeaders,
  server?: InteractiveServer,
): Promise<boolean> {
  const match = PREPARE_PATH.exec(url.pathname);
  if (!match) return false;
  interactiveHeaders(response);
  if (!server || url.search) {
    finish(response, method, 404, "Not found.");
    return true;
  }
  if (method !== "POST") {
    finish(response, method, 405, "Method not allowed.");
    return true;
  }
  const host = localHost({ headers });
  if (!host || headers.origin !== `http://${host}`) {
    finish(response, method, 403, "This request is not allowed.");
    return true;
  }
  const generation = match[1]!;
  const result = await server.prepare(generation);
  if (!result) {
    finish(response, method, 404, "Not found.");
    return true;
  }
  if (result.state === "ready") {
    sendInteractiveState(response, 200, generation, "ready", method);
    return true;
  }
  sendInteractiveState(
    response,
    result.failure === "bundle" ? 503 : 500,
    generation,
    "failed",
    method,
  );
  return true;
}

function finish(
  response: ServerResponse,
  method: string,
  status: number,
  message: string,
): void {
  sendInteractive(
    response,
    status,
    "text/plain; charset=utf-8",
    message,
    method,
  );
}
