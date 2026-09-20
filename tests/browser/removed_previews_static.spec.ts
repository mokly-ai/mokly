import { expect, test } from "@playwright/test";

import {
  startExportedPreviews,
  type RemovedPreviewHost,
} from "./removed_preview_fixture.js";

let host: RemovedPreviewHost & { requests: readonly string[] };

test.beforeAll(async () => {
  test.setTimeout(240_000);
  host = await startExportedPreviews();
});
test.afterAll(async () => {
  await host?.close();
});

const stage = "[data-mokly-preview]";

for (const width of [390, 1280]) {
  test(`an exported catalogue loads packaged previous versions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`${host.url}/view/archive/removed.html`);
    await expect(page.locator(".mbk-previous")).toHaveText(
      "Showing previous version",
    );
    await expect(page.frameLocator(`${stage} iframe`).locator("h1")).toHaveText(
      "Previous page",
    );
    await page.goto(`${host.url}/view/screens/removed.html`);
    await expect(
      page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
    ).toHaveText("Previous desktop screen");
    expect(
      requests.filter((url) => /\/__mokly\/diffs\/review\.json/.test(url)),
    ).toEqual([]);
    expect(
      requests.filter((url) =>
        /\/pages\/archive\/removed\.html\.json$/.test(url),
      ),
    ).toHaveLength(1);
  });
}

test("a catalogue that advertises nothing stays quiet", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route(`${host.url}/view/archive/removed.html`, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /,&quot;published&quot;:\{[^}]*\}/,
      "",
    );
    await route.fulfill({ response, body });
  });
  await page.goto(`${host.url}/view/archive/removed.html`);
  await expect(page.locator(`${stage} h2`)).toHaveText(
    "Previous version unavailable",
  );
  await expect(page.locator(`${stage} [data-mokly-preview-retry]`)).toHaveText(
    "Retry",
  );
  await page.locator('a[data-route="screens/removed.html"]').click();
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Previous desktop screen");
  expect(requests.filter((url) => url.includes("/pages/"))).toEqual([]);
});

test("an exported previous version stays read-only", async ({ page }) => {
  await page.goto(`${host.url}/view/archive/removed.html`);
  const document = page.frameLocator(`${stage} iframe`);
  await expect(document.locator("h1")).toHaveText("Previous page");
  const address = page.url();
  for (const label of ["Marked catalogue link", "Relative link"]) {
    await document.getByText(label, { exact: true }).click();
    await page.waitForTimeout(120);
    expect(page.url()).toBe(address);
  }
  await expect(document.locator("h1")).toHaveText("Previous page");
});
