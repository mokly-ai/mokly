/** Component-preview admission kept outside the catalogue route dispatcher. */

import type { IncomingMessage, ServerResponse } from "node:http";

import { handleControls, localHost } from "./controls/http.js";
import type { ComponentRenderService } from "./controls/service.js";
import type { ForegroundActivity } from "./demand/activity.js";
import { send } from "./respond.js";

/** Handle a denied host or component route before ordinary catalogue routing. */
export function handleComponentHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  controls: ComponentRenderService | undefined,
  activity: ForegroundActivity,
  diagnostic?: (error: unknown) => void,
): boolean {
  if (controls && !localHost(request)) {
    send(
      response,
      403,
      "text/plain",
      "This request is not allowed.",
      request.method ?? "GET",
    );
    return true;
  }
  if (!controls || !request.url?.startsWith("/__mokly/components/"))
    return false;
  const busy = activity.channel();
  busy(true);
  void handleControls(request, response, controls, diagnostic).finally(() =>
    busy(false),
  );
  return true;
}
