/** Private same-origin admission and immutable sandboxed memory responses. */
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  ComponentRenderError,
  renderStatus,
} from "../../components/render_types.js";
import { safeDecodePath } from "../respond.js";

import type { ComponentRenderService } from "./service.js";

/**
 * Accept exact loopback Host names with any canonical valid port, including
 * forwarded ports. The regex is fully anchored; without multiline mode,
 * JavaScript's $ admits no trailing newline.
 */
export function localHost(
  request: Pick<IncomingMessage, "headers">,
): string | undefined {
  const host = request.headers.host;
  const match = /^(?:localhost|127\.0\.0\.1):([1-9][0-9]{0,4})$/.exec(
    host ?? "",
  );
  return match && Number(match[1]) <= 65_535 ? host : undefined;
}
export async function handleControls(
  request: IncomingMessage,
  response: ServerResponse,
  service: ComponentRenderService,
): Promise<void> {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  try {
    const host = localHost(request);
    if (!host)
      throw new ComponentRenderError(
        "forbidden",
        "This request is not allowed.",
      );
    const url = new URL(request.url!, `http://${host}`);
    if (url.pathname.startsWith("/__mokly/components/renders/")) {
      if (request.method !== "GET" && request.method !== "HEAD")
        throw new ComponentRenderError(
          "method",
          "Use GET to open this preview.",
        );
      const [id, ...pieces] = url.pathname
        .slice("/__mokly/components/renders/".length)
        .split("/");
      const route = safeDecodePath(pieces.join("/"));
      const bundle = service.store.get(id ?? "");
      const file = route && bundle.files.get(route);
      if (!file)
        throw new ComponentRenderError("unknown-entry", "Preview not found.");
      response.setHeader("content-type", file.type);
      if (file.type.startsWith("text/html"))
        response.setHeader(
          "content-security-policy",
          "sandbox allow-same-origin; frame-ancestors 'self'",
        );
      response.writeHead(200);
      response.end(request.method === "HEAD" ? undefined : file.bytes);
      return;
    }
    if (url.pathname !== "/__mokly/components/render")
      throw new ComponentRenderError("unknown-entry", "Not found.");
    if (request.method !== "POST")
      throw new ComponentRenderError("method", "Use POST to update props.");
    if (
      request.headers.origin !== `http://${host}` ||
      request.headers["x-mokly-render-token"] !== service.token
    )
      throw new ComponentRenderError(
        "forbidden",
        "This request is not allowed. Reload the catalogue and try again.",
      );
    if (
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
        request.headers["content-type"] ?? "",
      )
    )
      throw new ComponentRenderError(
        "invalid-input",
        "Send the prop values as JSON.",
      );
    const controller = new AbortController();
    response.once("close", () => controller.abort());
    const value = await readJson(request);
    const result = await service.render(value, controller.signal);
    json(response, 200, result, request.method);
  } catch (error) {
    const failure =
      error instanceof ComponentRenderError
        ? error
        : new ComponentRenderError(
            "render-failed",
            "The preview could not be rendered. Try again or reset the props.",
          );
    if (failure.detail !== undefined)
      process.stderr.write(`${failure.detail}\n`);
    if (!response.destroyed)
      json(
        response,
        renderStatus[failure.code],
        { code: failure.code, message: failure.message },
        request.method,
      );
  }
}
function json(
  response: ServerResponse,
  status: number,
  body: unknown,
  method?: string,
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(method === "HEAD" ? undefined : JSON.stringify(body));
}
async function readJson(request: IncomingMessage): Promise<unknown> {
  if (Number(request.headers["content-length"] ?? 0) > 65536) {
    request.resume();
    throw new ComponentRenderError(
      "too-large",
      "The prop values are too large.",
    );
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const data of request) {
    const chunk = Buffer.from(data as Uint8Array);
    length += chunk.byteLength;
    if (length > 65536)
      throw new ComponentRenderError(
        "too-large",
        "The prop values are too large.",
      );
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ComponentRenderError(
      "invalid-input",
      "The prop values could not be read. Try again.",
    );
  }
}
