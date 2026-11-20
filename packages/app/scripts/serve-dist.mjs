import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, relative, resolve, sep } from "node:path";

/**
 * Serve the exported web build the way a single-page deployment does: real
 * files when they exist, and the application document for every other path, so
 * a deep project link reaches the router.
 */
const root = resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? process.env.MKC_APP_PORT ?? 8081);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function insideRoot(candidate) {
  const fromRoot = relative(root, candidate);
  return (
    fromRoot === "" || (!fromRoot.startsWith(".." + sep) && fromRoot !== "..")
  );
}

async function resolveFile(pathname) {
  const candidate = resolve(root, "." + pathname);
  if (!insideRoot(candidate)) return undefined;
  try {
    const found = await stat(candidate);
    if (found.isFile()) return candidate;
  } catch {
    if (extname(pathname) !== "") return undefined;
  }
  return resolve(root, "index.html");
}

createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  void resolveFile(pathname).then((file) => {
    if (file === undefined) {
      response.statusCode = 404;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.setHeader("cache-control", "no-store");
      response.end("Not Found\n");
      return;
    }
    response.setHeader(
      "content-type",
      types[extname(file)] ?? "application/octet-stream",
    );
    response.setHeader("cache-control", "no-store");
    createReadStream(file).pipe(response);
  });
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`serving ${root} at http://localhost:${port}\n`);
});
