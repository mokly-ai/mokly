import { expect, test } from "@playwright/test";

import { serveStaticFiles } from "../helpers/static_server.js";

import { startStaticFixture } from "./static_fixture.js";

test("a second origin can fetch catalogue and fragment with exact-origin headers and no credentials", async ({
  page,
  request,
  context,
}) => {
  const site = await startStaticFixture(false, true);
  const host = await serveStaticFiles(site.root);
  const source = await serveStaticFiles(site.root, { allowedOrigin: host.url });
  try {
    await page.goto(host.url);
    await context.addCookies([
      { name: "catalogue-test", value: "must-be-omitted", url: source.url },
    ]);
    const result = await page.evaluate(async (origin) => {
      const response = await fetch(`${origin}/__mokly/catalogue.json`, {
        credentials: "omit",
      });
      const model = await response.json();
      const fragment = await fetch(
        new URL(model.screens[0].views[0].fragmentPath, origin),
        { credentials: "omit" },
      );
      return {
        version: model.schemaVersion,
        status: fragment.status,
        html: await fragment.text(),
      };
    }, source.url);
    expect(result.version).toBe(1);
    expect(result.status).toBe(200);
    expect(result.html).toContain("<html");
    expect(source.requestHeaders).toHaveLength(2);
    for (const headers of source.requestHeaders) {
      expect(headers.cookie).toBeUndefined();
      expect(headers.authorization).toBeUndefined();
      expect(headers.origin).toBe(host.url);
    }
    for (const route of [
      "/__mokly/catalogue.json",
      "/static/screens/home.mobile.html",
      "/static/missing.html",
    ]) {
      for (const method of ["GET", "HEAD"] as const) {
        const response = await request.fetch(`${source.url}${route}`, {
          method,
          headers: { Origin: host.url },
        });
        expect(response.headers()["access-control-allow-origin"]).toBe(
          host.url,
        );
        expect(response.headers()["x-content-type-options"]).toBe("nosniff");
        expect(response.headers()["vary"]).toBe("Origin");
        if (method === "HEAD") expect(await response.body()).toHaveLength(0);
      }
    }
  } finally {
    await source.close();
    await host.close();
    await site.close();
  }
});

test("same-origin reads need no CORS or wildcard and the shell never requests the read model", async ({
  page,
}) => {
  const site = await startStaticFixture(false, true);
  const other = await serveStaticFiles(site.root);
  try {
    await page.goto(`${site.url}/view/screens/home.html`);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    expect(site.requests).not.toContain("/__mokly/catalogue.json");
    const result = await page.evaluate(async (otherOrigin) => {
      const same = await fetch("/__mokly/catalogue.json", {
        credentials: "omit",
      });
      let crossOrigin = "readable";
      try {
        await fetch(`${otherOrigin}/__mokly/catalogue.json`, {
          credentials: "omit",
        });
      } catch {
        crossOrigin = "blocked";
      }
      return {
        status: same.status,
        origin: same.headers.get("access-control-allow-origin"),
        crossOrigin,
      };
    }, other.url);
    expect(result).toEqual({
      status: 200,
      origin: null,
      crossOrigin: "blocked",
    });
    await expect(
      serveStaticFiles(site.root, { allowedOrigin: "*" }),
    ).rejects.toThrow("exact origin");
  } finally {
    await other.close();
    await site.close();
  }
});
