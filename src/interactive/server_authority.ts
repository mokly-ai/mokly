/** Explicit authority admission for requests to the isolated Live origin. */

import type { IncomingMessage } from "node:http";

import { localHost } from "../server/controls/http.js";

/** Accept loopback authority or the one explicitly configured forwarded authority. */
export function interactiveHost(
  request: Pick<IncomingMessage, "headers">,
  explicitOrigin?: string,
): string | undefined {
  const local = localHost(request);
  if (local) return local;
  const host = request.headers.host;
  return explicitOrigin && host === new URL(explicitOrigin).host
    ? host
    : undefined;
}
