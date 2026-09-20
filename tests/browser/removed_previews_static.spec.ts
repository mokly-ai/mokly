import { expect, test, type Page } from "@playwright/test";

import {
  startExportedPreviews,
  type RemovedPreviewHost,
} from "./removed_preview_fixture.js";
import { chooseViewport } from "./workspace_actions.js";

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

/** Only the fields this file rewrites; the rest is passed through unchanged. */
interface CapturedViews {
  screens: { views: { viewport: string }[] }[];
}

/** Deliver one screen's comparison as if only its desktop views were captured. */
async function dropMobileViews(page: Page): Promise<void> {
  await page.route("**/__generations/**/review.json", async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as CapturedViews;
    for (const screen of payload.screens)
      screen.views = screen.views.filter((view) => view.viewport !== "mobile");
    await route.fulfill({ response, body: JSON.stringify(payload) });
  });
}

test("a viewport with no captured previous view says so", async ({ page }) => {
  const note = `${stage} .mbk-preview-note`;
  const rest = `${note} .mbk-preview-switch`;
  await dropMobileViews(page);
  await page.goto(`${host.url}/view/screens/removed.html`);
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Previous desktop screen");
  await expect(page.locator(`${stage} .mbk-frame-mobile`)).toHaveCount(0);
  await expect(page.locator(note)).toContainText(
    "No previous mobile version was captured.",
  );
  await expect(page.locator(rest)).toBeHidden();

  await chooseViewport(page, "mobile");
  await expect(page.locator(`${stage} iframe`)).toHaveCount(0);
  await expect(page.locator(note)).toHaveText(
    "No previous mobile version was captured. Switch to Desktop to see it.",
  );
  await expect(page.locator(rest)).toBeVisible();

  await chooseViewport(page, "desktop");
  await expect(page.locator(note)).toHaveCount(0);
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Previous desktop screen");
});

test("an exported previous version stays read-only", async ({ page }) => {
  await page.goto(`${host.url}/view/archive/removed.html`);
  const preview = page.frameLocator(`${stage} iframe`);
  await expect(preview.locator("h1")).toHaveText("Previous page");
  const address = page.url();
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents.push(request.url());
  });
  for (const label of ["Marked catalogue link", "Relative link"])
    await preview.getByText(label, { exact: true }).click();
  await preview.getByText("Jump to the end").click();
  await expect(preview.locator("#foot")).toBeInViewport();
  expect(documents).toEqual([]);
  expect(page.url()).toBe(address);
  await expect(preview.locator("h1")).toHaveText("Previous page");
});
