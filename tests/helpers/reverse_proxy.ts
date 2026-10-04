import http from "node:http";

/** A real forwarding listener with a separate browser-facing authority. */
export async function reverseProxy(hostname: string, rewriteHost = true) {
  let upstream: URL | undefined;
  const requests: {
    host?: string;
    origin?: string;
    path: string;
    status: number;
  }[] = [];
  const proxy = http.createServer((incoming, response) => {
    if (!upstream) {
      response.writeHead(502);
      response.end();
      return;
    }
    const target = upstream;
    const outgoing = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: incoming.url,
        method: incoming.method,
        headers: {
          ...incoming.headers,
          ...(rewriteHost ? { host: target.host } : {}),
        },
      },
      (reply) => {
        requests.push({
          ...(incoming.headers.host ? { host: incoming.headers.host } : {}),
          ...(incoming.headers.origin
            ? { origin: incoming.headers.origin }
            : {}),
          path: incoming.url ?? "/",
          status: reply.statusCode ?? 0,
        });
        response.writeHead(reply.statusCode ?? 502, reply.headers);
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
    proxy.once("error", reject);
    proxy.listen(0, "127.0.0.1", resolve);
  });
  const address = proxy.address();
  if (!address || typeof address === "string") throw new Error("No proxy port");
  return {
    requests,
    url: `http://${hostname}:${address.port}`,
    forwardTo(url: string) {
      upstream = new URL(url);
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        proxy.close((error) => (error ? reject(error) : resolve()));
        proxy.closeAllConnections();
      });
    },
  };
}
