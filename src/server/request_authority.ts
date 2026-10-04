/** Exact Host and Origin admission shared by both loopback Serve listeners. */

import type { IncomingHttpHeaders, IncomingMessage } from "node:http";

/** Accept only the existing loopback names and canonical explicit valid ports. */
export function localHost(
  request: Pick<IncomingMessage, "headers">,
): string | undefined {
  const host = request.headers.host;
  const match = /^(?:localhost|127\.0\.0\.1):([1-9][0-9]{0,4})$/.exec(
    host ?? "",
  );
  return match && Number(match[1]) <= 65_535 ? host : undefined;
}

/** Add one configured authority without trusting any forwarded header. */
export function requestHost(
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

/** Admit the matching loopback Origin or one exact configured app Origin. */
export function requestOrigin(
  headers: IncomingHttpHeaders,
  appOrigin?: string,
): boolean {
  if (!requestHost({ headers }, appOrigin)) return false;
  if (appOrigin !== undefined && headers.origin === appOrigin) return true;
  const local = localHost({ headers });
  return local !== undefined && headers.origin === `http://${local}`;
}
