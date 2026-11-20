import type { Protocol } from "electron";

import { isDesktopAddress } from "./origin.js";

export interface ExportFiles {
  resolve(...paths: string[]): string;
  sep: string;
  extname(path: string): string;
  realpath(path: string): Promise<string>;
  stat(path: string): Promise<{ isFile(): boolean; size: number }>;
  read(path: string): Promise<Uint8Array>;
}

const types: Record<string, string> = {
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

/** Register before app readiness, with Chromium's origin, fetch and CORS support. */
export function registerScheme(
  protocol: Pick<Protocol, "registerSchemesAsPrivileged">,
): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "mokly-app",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

function inside(root: string, path: string, sep: string): boolean {
  return path === root || path.startsWith(root + sep);
}

/** Resolve real paths too, so an export symlink cannot expose another directory. */
export async function resolveExport(
  files: ExportFiles,
  root: string,
  pathname: string,
): Promise<string | undefined> {
  const path = decodeURIComponent(pathname);
  const file = files.resolve(root, `.${path}`);
  if (
    path.includes("\0") ||
    path.includes("\\") ||
    !inside(root, file, files.sep) ||
    path === "/_health" ||
    path === "/_config"
  )
    return undefined;
  try {
    const real = await files.realpath(file);
    if (!inside(await files.realpath(root), real, files.sep)) return undefined;
    if ((await files.stat(real)).isFile()) return real;
  } catch (error) {
    if (!["ENOENT", "ENOTDIR"].includes((error as { code: string }).code))
      throw error;
  }
  if (files.extname(path)) return undefined;
  const index = await files.realpath(files.resolve(root, "index.html"));
  return inside(await files.realpath(root), index, files.sep)
    ? index
    : undefined;
}

/** Only bundled bytes are served; there is no runtime configuration route. */
export function exportHandler(
  files: ExportFiles,
  root: string,
  policy: string,
) {
  return async (request: Request): Promise<Response> => {
    const headers: Record<string, string> = {
      "Content-Security-Policy": policy,
      "X-Content-Type-Options": "nosniff",
    };
    const respond = (status: number, body: BodyInit | null = null) =>
      new Response(body, { status, headers });
    if (!["GET", "HEAD"].includes(request.method)) {
      headers.Allow = "GET, HEAD";
      return respond(405);
    }
    try {
      const url = new URL(request.url);
      if (!isDesktopAddress(url)) return respond(404);
      const file = await resolveExport(files, root, url.pathname);
      if (!file) return respond(404);
      const info = await files.stat(file);
      headers["Content-Type"] =
        types[files.extname(file)] ?? "application/octet-stream";
      headers["Content-Length"] = String(info.size);
      return respond(
        200,
        request.method === "HEAD"
          ? null
          : ((await files.read(file)) as BodyInit),
      );
    } catch (error) {
      return respond(error instanceof URIError ? 400 : 500);
    }
  };
}
