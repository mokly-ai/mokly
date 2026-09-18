import http from "node:http";

import { expect, test } from "@playwright/test";

import { componentRuntime } from "../../dist/build/component_runtime.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import { componentReviewFixture } from "../helpers/component_review_fixture.js";

for (const hostname of ["127.0.0.1", "localhost"])
  test(`${hostname}: forwarded controls edit previews and restore a saved variant`, async ({
    page,
  }) => {
    const cleanup: (() => Promise<void>)[] = [];
    try {
      const fixture = await componentReviewFixture(
        { after: (dispose) => cleanup.push(dispose) },
        (source) => source,
      );
      const server = await startCatalogueServer(fixture.config, {
        base: "main",
        port: 0,
        componentRuntime: componentRuntime(fixture.after),
      });
      cleanup.push(() => server.close());
      const upstream = new URL(server.url);
      const forwarded: {
        host: string | undefined;
        method: string | undefined;
      }[] = [];
      const proxy = http.createServer((incoming, response) => {
        if (incoming.url?.startsWith("/__mokly/components/"))
          forwarded.push({
            host: incoming.headers.host,
            method: incoming.method,
          });
        const outgoing = http.request(
          {
            hostname: upstream.hostname,
            port: upstream.port,
            path: incoming.url,
            method: incoming.method,
            headers: incoming.headers,
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
      cleanup.push(
        () =>
          new Promise<void>((resolve, reject) => {
            proxy.close((error) => (error ? reject(error) : resolve()));
            proxy.closeAllConnections();
          }),
      );
      await new Promise<void>((resolve, reject) => {
        proxy.once("error", reject);
        proxy.listen(0, "127.0.0.1", resolve);
      });
      const address = proxy.address();
      if (!address || typeof address === "string")
        throw new Error("No proxy port");
      expect(String(address.port)).not.toBe(upstream.port);
      const host = `${hostname}:${address.port}`;
      const navigation = await page.goto(
        `http://${host}/view/components/action.html`,
      );
      expect(navigation?.status()).toBe(200);
      await page
        .getByLabel("Viewport", { exact: true })
        .selectOption("desktop");
      await page.getByRole("tab", { name: "Props", exact: true }).click();
      const frame = page.frameLocator('[data-workspace-frame="desktop"]');
      const rendered = page.waitForResponse((response) =>
        response.url().endsWith("/__mokly/components/render"),
      );
      await page
        .getByLabel("label", { exact: true })
        .fill("Forwarded purchase");
      expect((await rendered).status()).toBe(200);
      await expect(
        frame.getByRole("button", { name: "Forwarded purchase" }),
      ).toBeVisible();
      await page
        .getByLabel("Saved variant", { exact: true })
        .selectOption("disabled");
      await expect(page.getByLabel("label", { exact: true })).toHaveValue(
        "Continue",
      );
      await expect(
        frame.getByRole("button", { name: "Continue" }),
      ).toBeDisabled();
      expect(forwarded.every((request) => request.host === host)).toBe(true);
      expect(forwarded.map((request) => request.method)).toEqual(
        expect.arrayContaining(["POST", "GET", "HEAD"]),
      );
    } finally {
      await page.goto("about:blank");
      for (const dispose of cleanup.reverse()) await dispose();
    }
  });
