/** Explicit authority admission for requests to the isolated Live origin. */

import type { IncomingMessage } from "node:http";

import { requestHost } from "../server/request_authority.js";

/** Accept loopback authority or the one explicitly configured forwarded authority. */
export function interactiveHost(
  request: Pick<IncomingMessage, "headers">,
  explicitOrigin?: string,
): string | undefined {
  return requestHost(request, explicitOrigin);
}
