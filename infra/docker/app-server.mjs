import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, extname, resolve, sep } from "node:path";
import process from "node:process";

const root = resolve(process.env.MKC_APP_DIRECTORY ?? "/app/dist");
const config = JSON.parse(
  await readFile(
    process.env.MKC_APP_BUILD_CONFIG ?? "/app/build-config.json",
    "utf8",
  ),
);
for (const kind of ["api", "app"]) {
  const expected = process.env[`EXPO_PUBLIC_MKC_${kind.toUpperCase()}_ORIGIN`];
  if (expected && expected !== config[`${kind}Origin`]) {
    throw new Error(`The app image was built for a different ${kind} origin`);
  }
}
if (
  process.env.MKC_EXPECTED_REVISION &&
  process.env.MKC_EXPECTED_REVISION !== config.revision
) {
  throw new Error("The app image was built from a different revision");
}
await stat(resolve(root, "index.html"));

// JavaScript, packaged images and CSS load from the app origin. Expo embeds
// some image assets as data URLs, React Native Web emits required inline
// layout styles, and Inter is the bundled same-origin font. The app/API
// origins are the baked browser endpoints; publication frames, grant exchange,
// confirmation and read-model requests use isolated catalogue subdomains.
// The viewer renders removed previews and comparison panes as script-disabled
// srcdoc documents, which inherit this policy: their stylesheets, images and
// fonts load from the publication's catalogue host, and their generated
// inline styles need the 'unsafe-inline' the app already allows.
const catalogueSource = `https://*.${config.catalogueBaseDomain}`;
const apiWebSocketUrl = new URL(config.apiOrigin);
apiWebSocketUrl.protocol = "wss:";
const contentSecurityPolicy = [
  "default-src 'self'",
  `frame-src 'self' ${config.appOrigin} ${config.apiOrigin} ${catalogueSource}`,
  `connect-src 'self' ${config.appOrigin} ${config.apiOrigin} ${apiWebSocketUrl.origin} ${catalogueSource}`,
  `img-src 'self' data: ${catalogueSource}`,
  `font-src 'self' ${catalogueSource}`,
  `style-src 'self' 'unsafe-inline' ${catalogueSource}`,
  "frame-ancestors 'none'",
].join("; ");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
};

const server = createServer(async (request, response) => {
  response.setHeader("Content-Security-Policy", contentSecurityPolicy);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const path = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (path === "/_health" || path === "/_config") {
      response.setHeader("Content-Type", "application/json");
      response.end(
        request.method === "HEAD"
          ? undefined
          : JSON.stringify(path === "/_health" ? { status: "ok" } : config),
      );
      return;
    }
    const exportPath = path;
    let file = resolve(root, `.${exportPath}`);
    if (
      exportPath.includes("\0") ||
      exportPath.includes("\\") ||
      (file !== root && !file.startsWith(root + sep))
    ) {
      response.writeHead(400).end();
      return;
    }
    let info;
    try {
      info = await stat(file);
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    }
    if (!info?.isFile()) {
      if (extname(exportPath)) {
        response.writeHead(404).end();
        return;
      }
      file = resolve(root, "index.html");
      info = await stat(file);
    }
    response.setHeader(
      "Content-Type",
      types[extname(file)] ?? "application/octet-stream",
    );
    response.setHeader("Content-Length", info.size);
    response.setHeader(
      "Cache-Control",
      /[-.][a-f0-9]{16,}\./.test(basename(file))
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    if (request.method === "HEAD") {
      response.end();
    } else {
      createReadStream(file)
        .on("error", () => response.destroy())
        .pipe(response);
    }
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 500).end();
  }
});
server.requestTimeout = 10_000;
server.headersTimeout = 10_000;
server.listen(Number(process.env.PORT ?? "8080"), "0.0.0.0");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 25_000).unref();
  });
}
