import assert from "node:assert/strict";
import type { ServerResponse } from "node:http";
import { test } from "node:test";

import type { Catalogue } from "@mokly/viewer/server";

import type { ResolvedConfig } from "../src/config/types.js";
import { handleCatalogueRequest } from "../src/server/http_routes.js";

for (const route of [
  "/mokly-viewer/shell.css",
  "/mokly-viewer/client/appearance-startup.js",
  "/mokly-viewer/client/react-shell.js",
  "/mokly-viewer/navigation/logical.js",
  "/mokly-viewer/fonts/InterVariable.woff2",
  "/mokly-viewer/events",
])
  test(`asset delivery does not decode the public catalogue: ${route}`, async () => {
    let status: number | undefined;
    const response = {
      writeHead(value: number) {
        status = value;
      },
      end() {},
    } as unknown as ServerResponse;
    const asset = Buffer.from("asset");
    await handleCatalogueRequest(
      route,
      "HEAD",
      response,
      {} as Catalogue,
      {} as ResolvedConfig,
      "main",
      () => undefined,
      new Set(),
      {
        clientModules: new Map([
          ["appearance-startup.js", asset],
          ["react-shell.js", asset],
        ]),
        navigationModules: new Map([["logical.js", asset]]),
        fontAssets: new Map([["InterVariable.woff2", asset]]),
      },
      () => 1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        read() {
          assert.fail(
            "Asset delivery must not read or validate catalogue data",
          );
        },
      },
    );
    assert.equal(status, 200);
  });
