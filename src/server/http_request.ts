import type {
  IncomingMessage,
  RequestListener,
  ServerResponse,
} from "node:http";

import { handleControls, localHost } from "./controls/http.js";
import type { ComponentRenderService } from "./controls/service.js";
import type { ForegroundActivity } from "./demand/activity.js";
import type { ServerOptions } from "./http_types.js";
import { send } from "./respond.js";

interface RequestAdmission {
  controls(): ComponentRenderService | undefined;
  activity: ForegroundActivity;
  onDiagnostic: ServerOptions["onDiagnostic"];
  dispatch(request: IncomingMessage, response: ServerResponse): Promise<void>;
}

/** Restrict controls to local requests and isolate each route's failure response. */
export function createHttpRequestListener(
  input: RequestAdmission,
): RequestListener {
  return (request, response) => {
    const controls = input.controls();
    if (controls && !localHost(request))
      return send(
        response,
        403,
        "text/plain",
        "This request is not allowed.",
        request.method ?? "GET",
      );
    if (controls && request.url?.startsWith("/__mokly/components/")) {
      const busy = input.activity.channel();
      busy(true);
      void handleControls(
        request,
        response,
        controls,
        input.onDiagnostic,
      ).finally(() => busy(false));
      return;
    }
    void input.dispatch(request, response).catch(() => {
      if (!response.destroyed && !response.headersSent)
        send(
          response,
          500,
          "text/plain",
          "Could not open this page.",
          request.method ?? "GET",
        );
    });
  };
}
