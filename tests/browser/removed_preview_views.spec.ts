import { mock } from "node:test";

import { expect, test } from "@playwright/test";

import {
  startServedPreviews,
  type RemovedPreviewHost,
} from "./removed_preview_fixture.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

let host: RemovedPreviewHost;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  host = await startServedPreviews();
});
test.afterAll(async () => {
  await host?.close();
});

const stage = "[data-mokly-preview]";

test("Dark shows the previous dark views a screen was captured in", async ({
  page,
}) => {
  await page.goto(`${host.url}/view/screens/removed-dark.html`);
  await chooseViewport(page, "desktop");
  await chooseScheme(page, "dark");
  await expect(
    page.locator(`${stage} .mbk-frame-desktop iframe`),
  ).toHaveAttribute(
    "data-mokly-preview-source",
    /\/screens\/removed-dark\.desktop\.dark\.html$/,
  );
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Previous themed desktop screen");
  await expect(
    page.locator(`${stage} [data-color-scheme-fallback]`),
  ).toHaveCount(0);
  await expect(page.locator(`${stage} .mbk-frame-scheme-note`)).toBeHidden();
});

test("Dark falls back to the light views a screen kept only", async ({
  page,
}) => {
  await page.goto(`${host.url}/view/screens/removed.html`);
  await chooseViewport(page, "desktop");
  await chooseScheme(page, "dark");
  await expect(
    page.locator(`${stage} .mbk-frame-desktop[data-color-scheme-fallback]`),
  ).toHaveCount(1);
  await expect(page.locator(`${stage} .mbk-frame-label`)).toHaveText(
    "Desktop — Light only",
  );
  await expect(
    page.locator(`${stage} .mbk-frame-desktop iframe`),
  ).toHaveAttribute(
    "data-mokly-preview-source",
    /\/screens\/removed\.desktop\.html$/,
  );
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Previous desktop screen");
});

for (const change of ["scheme", "viewport"] as const)
  test(`an expired preview is reacquired before changing the ${change}`, async ({
    page,
  }) => {
    let now = Date.now();
    mock.method(Date, "now", () => now);
    try {
      const selections: URL[] = [];
      const failed: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname === "/__mokly/diffs/review.json") selections.push(url);
      });
      page.on("response", (response) => {
        if (response.url().includes("/snapshots/") && !response.ok())
          failed.push(response.url());
      });
      await page.goto(`${host.url}/view/screens/removed.html`);
      await chooseViewport(page, "desktop");
      const desktop = page.locator(`${stage} .mbk-frame-desktop iframe`);
      await expect(
        page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
      ).toHaveText("Previous desktop screen");
      const expired = await desktop.getAttribute("data-mokly-preview-source");
      expect(expired).not.toBeNull();

      now += 120_001;
      const pruning = await page.request.get(
        `${host.url}/__mokly/diffs/review.json?page=archive%2Fremoved.html`,
      );
      expect(pruning.ok()).toBe(true);
      expect((await page.request.get(expired!)).status()).toBe(404);

      if (change === "scheme") await chooseScheme(page, "dark");
      else await chooseViewport(page, "mobile");

      const renewed =
        change === "scheme"
          ? `${stage} .mbk-frame-desktop iframe`
          : `${stage} .mbk-frame-mobile iframe`;
      await expect(page.frameLocator(renewed).locator("h1")).toHaveText(
        change === "scheme"
          ? "Previous desktop screen"
          : "Previous mobile screen",
      );
      await expect(page.locator(renewed)).not.toHaveAttribute(
        "data-mokly-preview-source",
        expired!,
      );
      expect(
        selections.map((url) => url.searchParams.get("route")).filter(Boolean),
      ).toEqual(["screens/removed.html", "screens/removed.html"]);
      expect(selections.some((url) => url.searchParams.has("refresh"))).toBe(
        false,
      );
      expect(failed).toEqual([]);
    } finally {
      mock.restoreAll();
    }
  });
