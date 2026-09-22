import fs from "node:fs";
import http from "node:http";
import path from "node:path";

/** Exact files plus directory indexes: no extension guessing or provider rules. */
export async function serveStaticFiles(
  root: string,
  options: { allowedOrigin?: string; csp?: string } = {},
) {
  const allowedOrigins = new Set<string>();
  if (options.allowedOrigin)
    allowedOrigins.add(exactOrigin(options.allowedOrigin));
  const requests: string[] = [];
  const requestHeaders: http.IncomingHttpHeaders[] = [];
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    requests.push(pathname);
    requestHeaders.push(request.headers);
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (allowedOrigins.size > 0) {
      response.setHeader("Vary", "Origin");
      if (request.headers.origin && allowedOrigins.has(request.headers.origin))
        response.setHeader(
          "Access-Control-Allow-Origin",
          request.headers.origin,
        );
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }
    void (async () => {
      const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
      let filename = path.resolve(root, relative);
      if (filename !== root && !filename.startsWith(`${root}${path.sep}`))
        throw new Error("outside root");
      if ((await fs.promises.stat(filename)).isDirectory())
        filename = path.join(filename, "index.html");
      const types: Record<string, string> = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
      };
      response.setHeader(
        "Content-Type",
        types[path.extname(filename)] ?? "application/octet-stream",
      );
      if (options.csp && path.extname(filename) === ".html")
        response.setHeader("Content-Security-Policy", options.csp);
      const contents = await fs.promises.readFile(filename);
      response.end(request.method === "HEAD" ? undefined : contents);
    })().catch(() => {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end(request.method === "HEAD" ? undefined : "Not found");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No static test port");
  return {
    allowOrigin(origin: string): void {
      allowedOrigins.add(exactOrigin(origin));
    },
    requests,
    requestHeaders,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function exactOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Static fixture requires an exact origin");
  }
  if (!/^https?:\/\//.test(value) || parsed.origin !== value)
    throw new Error("Static fixture requires an exact origin");
  return value;
}
