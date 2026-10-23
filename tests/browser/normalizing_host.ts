/**
 * A local host in front of a static output that normalizes HTML URLs, as some
 * providers do: a request for a document under `/static/` that ends in
 * `.html` gets a permanent redirect to the same path without `.html`, with
 * the query kept, and that address serves the document.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";

export async function normalizingHost(upstream: string) {
  const origin = new URL(upstream);
  const redirected: string[] = [];
  const documents = new Map<string, string>();
  const server = http.createServer((incoming, response) => {
    const url = new URL(incoming.url ?? "/", origin);
    if (url.pathname.startsWith("/static/") && url.pathname.endsWith(".html")) {
      const normalized = url.pathname.slice(0, -".html".length);
      redirected.push(url.pathname);
      documents.set(normalized, url.pathname);
      response.writeHead(308, { location: `${normalized}${url.search}` });
      response.end();
      return;
    }
    const outgoing = http.request(
      {
        hostname: origin.hostname,
        port: origin.port,
        path: `${documents.get(url.pathname) ?? url.pathname}${url.search}`,
        method: incoming.method,
        headers: { ...incoming.headers, host: origin.host },
      },
      (reply) => {
        response.writeHead(reply.statusCode!, reply.headers);
        reply.pipe(response);
      },
    );
    outgoing.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    response.on("close", () => outgoing.destroy());
    incoming.pipe(outgoing);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    redirected,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
