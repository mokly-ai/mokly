/**
 * The Serve comparison wait follows the request its action starts, through
 * the redirect to a generation, and ignores an earlier request that is still
 * pending. A plain loopback server stands in for Serve so each order is exact.
 */

import { once } from "node:events";
import { createServer } from "node:http";

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { gate, loadComparison } from "./serve_comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";

for (const refresh of [false, true]) {
  test(`comparison waits track ${refresh ? "refresh" : "initial"} requests through redirects`, async ({
    page,
    allowBrowserError,
  }) => {
    const action = refresh ? "Refresh comparison" : "Overlay";
    const root = "/mokly-viewer/diffs/selection";
    const intended = `${root}${refresh ? "?refresh=1" : ""}`;
    const current = "/mokly-viewer/diffs/generations/current/";
    const stale = refresh ? root : "/mokly-viewer/diffs/generations/stale/";
    const arrivedStale = gate();
    const arrivedIntended = gate();
    const releaseStale = gate();
    const releaseIntended = gate();
    const server = createServer(async (request, response) => {
      if (request.url === stale) {
        arrivedStale.resolve();
        await releaseStale.promise;
        response.writeHead(refresh ? 200 : 500, {
          "content-type": "application/json",
        });
        response.end('{"entries":[]}');
      } else if (request.url === intended) {
        arrivedIntended.resolve();
        await releaseIntended.promise;
        response.writeHead(302, { location: current });
        response.end();
      } else if (request.url === current) {
        // A retained generation root answers 204 with no body.
        response.writeHead(refresh ? 503 : 204);
        response.end();
      } else {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(`<button id="trigger">${action}</button>`);
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing fixture port");
      const origin = `http://127.0.0.1:${address.port}`;
      allowBrowserError(
        refresh
          ? responseFailure(origin, current, 503)
          : responseFailure(origin, stale, 500),
      );
      await page.goto(`${origin}/`);
      await page.locator("#trigger").evaluate((button, endpoint) => {
        button.addEventListener("click", () => {
          void fetch(endpoint);
        });
      }, intended);
      const background = page.evaluate(async (endpoint) => {
        await (await fetch(endpoint)).text();
      }, stale);
      await arrivedStale.promise;
      const outcome = loadComparison(page, action).then(
        () => true,
        () => false,
      );
      await arrivedIntended.promise;
      releaseStale.resolve();
      await background;
      releaseIntended.resolve();
      expect(await outcome).toBe(!refresh);
    } finally {
      releaseStale.resolve();
      releaseIntended.resolve();
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  });
}
