import { once } from "node:events";
import { createServer } from "node:http";

import { expect, test } from "@playwright/test";

import { loadComparison } from "./comparison_actions.js";

function gate() {
  let release = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

for (const refresh of [false, true]) {
  test(`comparison waits track ${refresh ? "refresh" : "initial"} requests through redirects`, async ({
    page,
  }) => {
    const action = refresh ? "Refresh comparison" : "Overlay";
    const root = "/mokly-viewer/diffs/review.json";
    const intended = `${root}${refresh ? "?refresh=1" : ""}`;
    const stale = refresh
      ? root
      : "/mokly-viewer/diffs/generations/stale/review.json";
    const arrivedStale = gate();
    const arrivedIntended = gate();
    const releaseStale = gate();
    const releaseIntended = gate();
    const server = createServer(async (request, response) => {
      if (request.url === stale) {
        arrivedStale.release();
        await releaseStale.promise;
        response.writeHead(refresh ? 200 : 500, {
          "content-type": "application/json",
        });
        response.end('{"screens":[]}');
      } else if (request.url === intended) {
        arrivedIntended.release();
        await releaseIntended.promise;
        response.writeHead(302, {
          location: "/mokly-viewer/diffs/generations/current/review.json",
        });
        response.end();
      } else if (
        request.url === "/mokly-viewer/diffs/generations/current/review.json"
      ) {
        response.writeHead(refresh ? 503 : 200, {
          "content-type": "application/json",
        });
        response.end('{"screens":[]}');
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
      await page.goto(`http://127.0.0.1:${address.port}/`);
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
      releaseStale.release();
      await background;
      releaseIntended.release();
      expect(await outcome).toBe(!refresh);
    } finally {
      releaseStale.release();
      releaseIntended.release();
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  });
}
