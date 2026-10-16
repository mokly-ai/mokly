import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { staticRequests } from "./static_delivery_assertions.js";
import { staticEmbeddedFixture } from "./static_embedded_fixture.js";
import { copiedStaticDirectory } from "./static_test.js";

let fixture: Awaited<ReturnType<typeof staticEmbeddedFixture>>;
test.beforeAll(async () => {
  fixture = await staticEmbeddedFixture();
});

test("a public embedded viewer fetches copied data without credentials or live endpoints", async ({
  page,
  context,
}) => {
  const requests = staticRequests(page);
  await context.addCookies([
    { name: "private", value: "must-not-send", url: fixture.frames.url },
  ]);
  await page.goto(fixture.host.url);
  await expect(page.locator("#viewer h2")).toHaveText("Welcome");
  await expect(page.locator("iframe").first()).toHaveAttribute(
    "sandbox",
    "allow-same-origin allow-scripts",
  );
  await page.getByRole("tab", { name: "Components", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Highlight components", exact: true })
    .click();
  await expect(
    page
      .frameLocator('iframe[data-workspace-frame="mobile"]')
      .locator("[data-mokly-overlay]")
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .locator('a[data-route="example/screens/details/index.html"]')
    .click();
  await expect(page.locator("#viewer h2")).toHaveText("Details");
  await page.clock.install();
  await page.clock.fastForward(120_000);
  const data = fixture.frames.requests
    .map((route, index) => ({
      route,
      headers: fixture.frames.requestHeaders[index]!,
    }))
    .filter(
      ({ route }) =>
        route === "/mokly-viewer/index.json" ||
        route.startsWith("/mokly-viewer/entries/"),
    );
  expect(data.length).toBeGreaterThan(1);
  for (const { headers } of data) {
    expect(headers.origin).toBe(fixture.host.url);
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
  }
  requests.assert();
});

test("public static paths use exact-origin CORS, MIME and nosniff on GET, HEAD and errors", async ({
  page,
  request,
}) => {
  const directory = copiedStaticDirectory();
  const fonts = await fs.readdir(path.join(directory, "mokly-viewer/fonts"));
  const paths = [
    "mokly-viewer/index.json",
    "mokly-viewer/entries/example/screens/welcome.json",
    "static/mokly-generated/example/screens/welcome/index.mobile.html",
    "mokly-viewer/client/inspector.js",
    "mokly-viewer/shell.css",
    `mokly-viewer/fonts/${fonts[0]}`,
    "mokly-viewer/missing.json",
  ];
  await page.goto(fixture.host.url);
  await expect(page.locator("#viewer h2")).toHaveText("Welcome");
  for (const route of paths) {
    for (const method of ["GET", "HEAD"]) {
      const response = await request.fetch(`${fixture.frames.url}/${route}`, {
        method,
        headers: { Origin: fixture.host.url },
      });
      expect(response.headers()["access-control-allow-origin"]).toBe(
        fixture.host.url,
      );
      expect(
        response.headers()["access-control-allow-credentials"],
      ).toBeUndefined();
      expect(response.headers()["vary"]).toBe("Origin");
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
      expect(response.status()).toBe(route.includes("missing") ? 404 : 200);
      if (route.endsWith(".json") && !route.includes("missing"))
        expect(response.headers()["content-type"]).toBe(
          "application/json; charset=utf-8",
        );
      const denied = await request.fetch(`${fixture.frames.url}/${route}`, {
        method,
        headers: { Origin: "https://unlisted.example" },
      });
      expect(denied.headers()["access-control-allow-origin"]).toBeUndefined();
    }
  }
  const index = await page.evaluate(
    async (url) =>
      (
        await fetch(`${url}/mokly-viewer/index.json`, { credentials: "omit" })
      ).json(),
    fixture.frames.url,
  );
  expect(index.schemaVersion).toBe(7);
  expect(index).not.toHaveProperty("live");
});
