import assert from "node:assert/strict";
import { extname, resolve, sep } from "node:path";
import test from "node:test";

import {
  exportHandler,
  registerScheme,
  resolveExport,
} from "../export-handler.js";
import type { ExportFiles } from "../export-handler.js";

const files: ExportFiles = {
  resolve,
  sep,
  extname,
  realpath: async (path) => {
    if (path === "/export/escape") return "/private/secret";
    return path;
  },
  stat: async (path) => {
    if (["/export", "/export/folder"].includes(path))
      return { size: 0, isFile: () => false };
    if (
      [
        "/export/index.html",
        "/export/app.js",
        "/export/plain",
        "/export/font.woff2",
        "/private/secret",
      ].includes(path)
    )
      return { size: 4, isFile: () => true };
    throw Object.assign(new Error("Missing"), { code: "ENOENT" });
  },
  read: async () => new TextEncoder().encode("body"),
};

test("the export resolver follows the app-server table with safe desktop differences", async () => {
  const cases: [string, string | undefined][] = [
    ["/", "/export/index.html"],
    ["/app.js", "/export/app.js"],
    ["/plain", "/export/plain"],
    ["/acme/project", "/export/index.html"],
    ["/folder", "/export/index.html"],
    ["/missing.js", undefined],
    ["/font.woff2", "/export/font.woff2"],
    ["/../secret", undefined],
    ["/%2e%2e%2fsecret", undefined],
    ["/escape", undefined],
    ["/bad%00", undefined],
    ["/bad%5csecret", undefined],
    ["/_health", undefined],
    ["/_config", undefined],
  ];
  for (const [path, expected] of cases)
    assert.equal(await resolveExport(files, "/export", path), expected, path);
  await assert.rejects(resolveExport(files, "/export", "/%QQ"), URIError);
});

test("all responses carry policy and nosniff; only GET and HEAD serve bytes", async () => {
  const handle = exportHandler(files, "/export", "policy");
  for (const [method, path, status] of [
    ["GET", "/app.js", 200],
    ["HEAD", "/app.js", 200],
    ["POST", "/app.js", 405],
    ["GET", "/missing.css", 404],
    ["GET", "/%ZZ", 400],
    ["GET", "/_config", 404],
  ] as const) {
    const response = await handle(
      new Request("mokly-app://desktop" + path, { method }),
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Content-Security-Policy"), "policy");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("Cache-Control"), null);
    if (method === "HEAD") assert.equal(await response.text(), "");
    if (method === "GET" && status === 200) {
      assert.equal(await response.text(), "body");
      assert.equal(
        response.headers.get("Content-Type"),
        "text/javascript; charset=utf-8",
      );
    }
    if (status === 405)
      assert.equal(response.headers.get("Allow"), "GET, HEAD");
  }
  assert.equal(
    (await handle(new Request("mokly-app://other/app.js"))).status,
    404,
  );
  assert.equal(
    (
      await exportHandler(
        {
          ...files,
          stat: async () => {
            throw new Error("unreadable");
          },
        },
        "/export",
        "policy",
      )(new Request("mokly-app://desktop/app.js"))
    ).status,
    500,
  );
});

test("the scheme is standard, secure and supports CORS fetches without bypassing CSP", () => {
  registerScheme({
    registerSchemesAsPrivileged: (schemes) =>
      assert.deepEqual(schemes, [
        {
          scheme: "mokly-app",
          privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
          },
        },
      ]),
  });
});

test("SPA fallback cannot follow an index symlink outside the export", async () => {
  const redirected: ExportFiles = {
    ...files,
    realpath: async (path) =>
      path === "/export/index.html" ? "/private/secret" : files.realpath(path),
  };
  assert.equal(
    await resolveExport(redirected, "/export", "/project"),
    undefined,
  );
});
