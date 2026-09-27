/** Uniform uncached responses for the isolated interactive origin. */

import type { ServerResponse } from "node:http";

import type { InteractiveBundleState } from "@mokly/viewer/runtime";

/** Set the mandatory policy shared by every interactive-origin response. */
export function interactiveHeaders(response: ServerResponse): void {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
}

/** Send one complete response while preserving HEAD semantics. */
export function sendInteractive(
  response: ServerResponse,
  status: number,
  type: string,
  body: string | Buffer,
  method: string,
  headers: Readonly<Record<string, string>> = {},
): void {
  response.writeHead(status, {
    "content-type": type,
    ...headers,
  });
  response.end(method === "HEAD" ? undefined : body);
}

/** Send the small typed readiness body shared by both Serve origins. */
export function sendInteractiveState(
  response: ServerResponse,
  status: number,
  generation: string,
  state: Extract<InteractiveBundleState, "building" | "failed" | "ready">,
  method = "GET",
): void {
  sendInteractive(
    response,
    status,
    "application/json; charset=utf-8",
    JSON.stringify({ generation, state }),
    method,
  );
}
