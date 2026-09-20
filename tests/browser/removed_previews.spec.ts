import { expect, test } from "@playwright/test";

import {
  startServedPreviews,
  type RemovedPreviewHost,
} from "./removed_preview_fixture.js";

let host: RemovedPreviewHost;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  host = await startServedPreviews();
});
test.afterAll(async () => {
  await host?.close();
});

const stage = "[data-mokly-preview]";
const previewFrame = `${stage} iframe`;

for (const width of [390, 1280]) {
  test(`a removed document shows its previous version at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${host.url}/view/archive/removed.html`);
    await expect(page.locator(".mbk-previous")).toHaveText(
      "Showing previous version",
    );
    await expect(page.locator(".mbk-entry-status")).toHaveText("Removed");
    await expect(page.locator("#mb-main")).not.toContainText(
      "This page was removed",
    );
    await expect(
      page.locator("[data-diff-screen], [data-diff-mode], [data-diff-refresh]"),
    ).toHaveCount(0);
    const document = page.frameLocator(previewFrame);
    await expect(document.locator("h1")).toHaveText("Previous page");
    await expect(document.locator("body")).toHaveCSS(
      "background-color",
      "rgb(244, 239, 228)",
    );
  });

  test(`a removed screen shows its previous frames at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${host.url}/view/screens/removed.html`);
    await expect(page.locator(".mbk-previous")).toHaveText(
      "Showing previous version",
    );
    await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
    await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
    await expect(page.locator(`${stage} .phone-frame`)).toHaveCount(1);
    await expect(page.locator(`${stage} .browser-frame`)).toHaveCount(1);
    await expect(
      page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
    ).toHaveText("Previous desktop screen");
    await expect(
      page.frameLocator(`${stage} .mbk-frame-mobile iframe`).locator("h1"),
    ).toHaveText("Previous mobile screen");
    await page.locator("[data-workspace-viewport]").selectOption("mobile");
    await expect(page.locator(`${stage} .browser-frame`)).toHaveCount(0);
    await expect(
      page.frameLocator(`${stage} .mbk-frame-mobile iframe`).locator("h1"),
    ).toHaveText("Previous mobile screen");
    await expect(page.locator("[data-workspace-highlight]")).toBeDisabled();
    await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
  });
}

test("a previous version reads but never acts", async ({ page }) => {
  await page.goto(`${host.url}/view/archive/removed.html`);
  const preview = page.frameLocator(previewFrame);
  await expect(preview.locator("h1")).toHaveText("Previous page");
  const address = page.url();
  const inner = () =>
    page.frames().find((frame) => frame.url().includes("snapshots/before"))!;
  await expect(preview.getByText("Marked catalogue link")).toBeVisible();
  for (const label of [
    "Marked catalogue link",
    "Relative link",
    "External link",
    "Download link",
  ]) {
    await preview.getByText(label, { exact: true }).click();
    await page.waitForTimeout(150);
    expect(page.url()).toBe(address);
    expect(inner().url()).toContain("snapshots/before");
  }
  await preview.getByRole("button", { name: "Send" }).click();
  await page.waitForTimeout(150);
  expect(inner().url()).not.toContain("submitted");
  await preview.getByText("Marked catalogue link").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  expect(page.url()).toBe(address);
  const scrolled = await inner().evaluate(() => {
    document.documentElement.scrollTop = 400;
    return document.documentElement.scrollTop || document.body.scrollTop;
  });
  expect(scrolled).toBeGreaterThan(0);
  await preview.getByText("Jump to the end").click();
  await expect(preview.locator("#foot")).toBeInViewport();
  expect(page.url()).toBe(address);
});

test("a preview that cannot be loaded offers another attempt", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/__mokly/diffs/review.json?page=*", async (route) => {
    if (!fail) return route.continue();
    await route.fulfill({ status: 503, body: "{}" });
  });
  await page.goto(`${host.url}/view/archive/removed.html`);
  await expect(page.locator(`${stage} h2`)).toHaveText(
    "Previous version unavailable",
  );
  await expect(page.locator(`${stage} [data-mokly-preview-retry]`)).toHaveText(
    "Retry",
  );
  await page.locator('[data-filter="changed"]').click();
  await expect(
    page.locator('a[data-route="screens/removed.html"]'),
  ).toBeVisible();
  fail = false;
  await page.locator("[data-mokly-preview-retry]").click();
  await expect(page.frameLocator(previewFrame).locator("h1")).toHaveText(
    "Previous page",
  );
});

test("navigation fences a late response and keeps history usable", async ({
  page,
}) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__mokly/diffs/review.json?page=*", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(`${host.url}/view/screens/current.html`);
  await page.locator('[data-filter="changed"]').click();
  await page.locator('a[data-route="archive/removed.html"]').click();
  await expect(page.locator(".mbk-preview-status")).toHaveText(
    "Loading previous version…",
  );
  await page.locator('a[data-route="screens/removed.html"]').click();
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Previous desktop screen");
  release();
  await page.waitForTimeout(300);
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Previous desktop screen");
  await page.goBack();
  await expect(page.frameLocator(previewFrame).locator("h1")).toHaveText(
    "Previous page",
  );
  await page.goForward();
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Previous desktop screen");
});

test("browsing current entries requests no historical bytes", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`${host.url}/view/screens/current.html`);
  await expect(page.locator("[data-workspace-status]")).toBeVisible();
  await page.locator('[data-filter="changed"]').click();
  await page.locator('[data-filter="all"]').click();
  await page.locator("[data-workspace-viewport]").selectOption("mobile");
  await page.waitForTimeout(200);
  expect(requests.filter((url) => url.includes("/__mokly/diffs/"))).toEqual([]);
});
