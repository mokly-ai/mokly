import { expect, test, type Page } from "@playwright/test";

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

/** The historical document itself, so its own address can be inspected. */
function historical(page: Page) {
  return page
    .frames()
    .find((frame) => frame.url().includes("snapshots/before"))!;
}

/**
 * Report whether the browser has finished with a matching request, whether it
 * was delivered or cancelled. A fenced preview request settles either way, so
 * this replaces waiting on the clock for the response a navigation left behind.
 */
function settlement(page: Page, match: string): () => boolean {
  let done = false;
  const settle = (request: { url(): string }): void => {
    if (request.url().includes(match)) done = true;
  };
  page.on("requestfinished", settle);
  page.on("requestfailed", settle);
  return () => done;
}

/** Every top-level document the browser asked for, in order. */
function documentRequests(page: Page): readonly string[] {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") requested.push(request.url());
  });
  return requested;
}

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
  const opened = historical(page).url();
  const documents = documentRequests(page);
  for (const label of [
    "Marked catalogue link",
    "Relative link",
    "External link",
    "Download link",
  ])
    await preview.getByText(label, { exact: true }).click();
  await preview.getByRole("button", { name: "Send" }).click();
  await preview.getByText("Marked catalogue link").focus();
  await page.keyboard.press("Enter");
  await preview.getByText("Jump to the end").focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      historical(page).evaluate(() => {
        const foot = document.querySelector("#foot");
        if (!foot) return false;
        const bounds = foot.getBoundingClientRect();
        return bounds.top < window.innerHeight && bounds.bottom > 0;
      }),
    )
    .toBe(true);
  expect(documents).toEqual([]);
  expect(page.url()).toBe(address);
  expect(historical(page).url().split("#")[0]).toBe(opened);
});

test("Space scrolls a previous version while a link holds focus", async ({
  page,
}) => {
  await page.goto(`${host.url}/view/archive/removed.html`);
  const preview = page.frameLocator(previewFrame);
  await expect(preview.locator("h1")).toHaveText("Previous page");
  const address = page.url();
  const documents = documentRequests(page);
  const offset = () =>
    historical(page).evaluate(
      () => document.documentElement.scrollTop || document.body.scrollTop,
    );
  await preview.getByText("Marked catalogue link").focus();
  await page.keyboard.press("Space");
  await expect.poll(offset).toBeGreaterThan(0);
  await preview.getByText("Marked catalogue link").focus();
  await page.keyboard.press("Enter");
  expect(documents).toEqual([]);
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
  let handled = false;
  await page.route("**/__mokly/diffs/review.json?page=*", async (route) => {
    await held;
    await route.continue().catch(() => undefined);
    handled = true;
  });
  const settled = settlement(page, "review.json?page=");
  await page.goto(`${host.url}/view/screens/current.html`);
  await page.locator('[data-filter="changed"]').click();
  await page.locator('a[data-route="archive/removed.html"]').click();
  await expect(page.locator(".mbk-preview-status")).toHaveText(
    "Loading previous version…",
  );
  await page.locator('a[data-route="screens/removed.html"]').click();
  const mobile = page.frameLocator(`${stage} .mbk-frame-mobile iframe`);
  await expect(mobile.locator("h1")).toHaveText("Previous mobile screen");
  release();
  await expect.poll(() => handled && settled()).toBe(true);
  await expect(page.locator(".mbk-preview-status")).toHaveCount(0);
  await expect(mobile.locator("h1")).toHaveText("Previous mobile screen");
  await page.goBack();
  await expect(page.frameLocator(previewFrame).locator("h1")).toHaveText(
    "Previous page",
  );
  await page.goForward();
  await expect(mobile.locator("h1")).toHaveText("Previous mobile screen");
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
  await expect(
    page.frameLocator('iframe[data-workspace-frame="mobile"]').locator("main"),
  ).toHaveText("Current mobile");
  expect(requests.filter((url) => url.includes("/__mokly/diffs/"))).toEqual([]);
});

test.describe("without its browser client", () => {
  test.use({ javaScriptEnabled: false });

  test("a served stage never claims a request is in flight", async ({
    page,
  }) => {
    await page.goto(`${host.url}/view/archive/removed.html`);
    await expect(page.locator(".mbk-previous")).toHaveText(
      "Showing previous version",
    );
    await expect(page.locator(`${stage} h2`)).toHaveText(
      "Previous version unavailable",
    );
    await expect(page.locator("#mb-main")).not.toContainText(
      "Loading previous version",
    );
    await expect(
      page.locator(`${stage} [data-mokly-preview-retry]`),
    ).toHaveCount(0);
    await expect(page.locator(previewFrame)).toHaveCount(0);
  });
});
