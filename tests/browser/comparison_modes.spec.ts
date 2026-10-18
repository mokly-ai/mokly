import fs from "node:fs/promises";

import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  chooseFilter,
  comparisonIndex,
  modeButton,
  navRow,
  showMode,
  snapshotOf,
} from "./comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

const REVIEW = "**/mokly-viewer/diffs/generations/*/review.json";
const stage = "[data-diff-stage]";

test("Changes and screen browsing stay lazy until a diff is selected", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/mokly-viewer/diffs/"))
      requests.push(request.url());
  });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseFilter(page, "changed");
  await chooseViewport(page, "mobile");
  await chooseScheme(page, "dark");
  await navRow(page, comparisonPaths.darkOnly).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Dusk screen");
  await navRow(page, comparisonPaths.changed).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  expect(requests).toEqual([]);

  await showMode(page, "Overlay");
  await expect(page.locator(`${stage} .mb-panes`)).toHaveAttribute(
    "data-compare-mode",
    "overlay",
  );
  await expect(page.locator(`${stage} iframe`).first()).toHaveAttribute(
    "title",
    "Before — mobile — dark",
  );
  await expect(page.locator('button[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(requests.some((url) => url.endsWith("/review.json"))).toBe(true);
  await modeButton(page, "Current").click();
  await expect(page.locator("[data-current-screen]")).toBeVisible();
  await expect(page.locator(`${stage} iframe`)).toHaveCount(0);
});

test("unchanged views omit comparisons while changed views retain all modes", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.darkOnly}/`);
  await chooseScheme(page, "light");
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await chooseScheme(page, "dark");
  await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  await chooseViewport(page, "desktop");
  await showMode(page, "Overlay");
  for (const [name, mode] of [
    ["Difference", "difference"],
    ["Side by side", "side"],
  ] as const) {
    await showMode(page, name);
    await expect(page.locator(`${stage} .mb-panes`)).toHaveAttribute(
      "data-compare-mode",
      mode,
    );
  }
  await chooseViewport(page, "both");
  await expect(page.locator(`${stage} iframe`)).toHaveCount(4);
  await navRow(page, comparisonPaths.unchanged).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(page.locator(`${stage} iframe`)).toHaveCount(0);
});

test("added and removed screens stay current without comparison controls", async ({
  page,
  request,
  baseURL,
}) => {
  const index = await comparisonIndex(request, baseURL);
  await page.goto(`/view/${comparisonPaths.added}/`);
  await chooseFilter(page, "changed");
  await expect(navRow(page, comparisonPaths.added)).toBeVisible();
  await expect(page.locator("[data-workspace-status]")).toHaveText("Added");
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(
    page
      .frameLocator('[data-workspace-frame="desktop"]')
      .getByRole("heading", { name: "Added screen" }),
  ).toBeVisible();

  const snapshot = snapshotOf(index, comparisonPaths.removedScreen);
  await page.goto(
    `/view/${comparisonPaths.removedScreen}/?snapshot=${snapshot}`,
  );
  await chooseFilter(page, "changed");
  await expect(navRow(page, comparisonPaths.removedScreen)).toBeVisible();
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(page.locator("[data-current-screen]")).toHaveCount(0);
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(
    page
      .frameLocator("[data-mokly-preview] .mbk-frame-desktop iframe")
      .getByRole("heading", { name: "Historical screen" }),
  ).toBeVisible();
});

test("pending requests cannot replace Current or a newly navigated screen", async ({
  page,
}) => {
  let release = (): void => undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(REVIEW, async (route) => {
    const response = await route.fetch();
    await waiting;
    await route.fulfill({ response }).catch(() => undefined);
  });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await modeButton(page, "Overlay").click();
  await expect(page.locator(stage)).toContainText("Loading comparison");
  await modeButton(page, "Current").click();
  await expect(page.locator("[data-current-screen]")).toBeVisible();
  await navRow(page, comparisonPaths.unchanged).click();
  release();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");
  await expect(page.locator(`${stage} iframe`)).toHaveCount(0);
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
});

test("a failed comparison stays in the screen and retries explicitly", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  const index = await comparisonIndex(request, baseURL);
  allowBrowserError(responseFailure(baseURL!, `/${index.comparisonUrl}`, 500));
  await page.route(
    REVIEW,
    (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"error":"failed"}',
      }),
    { times: 1 },
  );
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await modeButton(page, "Overlay").click();
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  await expect(retry).toBeVisible();
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  await expect(modeButton(page, "Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await retry.click();
  await expect(page.locator(`${stage} iframe`)).toHaveCount(4);
  await expect(page.locator(`${stage} iframe`).first()).toHaveAttribute(
    "data-mokly-preview-source",
    /\/snapshots\/before\//,
  );
});

test("snapshot panes keep marked links inert", async ({ page }) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "desktop");
  await showMode(page, "Side by side");
  const iframe = page.locator(`${stage} .mb-pane--before iframe`);
  const source = await iframe.getAttribute("data-mokly-preview-source");
  const before = page.url();
  await iframe.contentFrame().locator("#snapshot-link").click();
  await expect(page).toHaveURL(before);
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  await expect(iframe.contentFrame().locator("h1")).toHaveText("Before screen");
  await expect(iframe).toHaveAttribute("data-mokly-preview-source", source!);
  expect(
    await iframe.evaluate(
      (frame: HTMLIFrameElement) => frame.contentDocument?.URL,
    ),
  ).toBe("about:srcdoc");
});

test("narrow diffs fit the shell and retain the catalogue drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "mobile");
  await showMode(page, "Overlay");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Open catalogue navigation" }).click();
  await expect(navRow(page, comparisonPaths.unchanged)).toBeVisible();
  await navRow(page, comparisonPaths.unchanged).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");
});

test("mode switches keep frames and focus and cannot expand one side alone", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "desktop");
  await showMode(page, "Overlay");
  const frame = await page.locator(`${stage} iframe`).first().elementHandle();
  expect(frame).not.toBeNull();
  await expect(page.locator(`${stage} .browser-expand`)).toHaveCount(0);
  await modeButton(page, "Difference").click();
  await expect(modeButton(page, "Difference")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await frame?.evaluate((node) => node.isConnected)).toBe(true);
  await frame?.dispose();
  // Keyboard activation keeps focus on the pressed mode.
  for (const name of [
    "Side by side",
    "Overlay",
    "Difference",
    "Current",
  ] as const) {
    await modeButton(page, name).focus();
    await page.keyboard.press("Enter");
    await expect(modeButton(page, name)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(modeButton(page, name)).toBeFocused();
  }
});

test("released review v6 uses the standalone version message", async ({
  page,
}) => {
  const released = JSON.parse(
    await fs.readFile(
      new URL("../fixtures/released-review-v6.json", import.meta.url),
      "utf8",
    ),
  );
  await page.route(REVIEW, (route) => route.fulfill({ json: released }));
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await modeButton(page, "Overlay").click();
  await expect(page.getByRole("alert")).toContainText(
    "This catalogue needs a compatible viewer",
  );
  await page.locator("[data-comparison-failure] summary").click();
  await expect(page.locator("[data-comparison-failure]")).toContainText(
    "Unsupported Mokly review version 6; this viewer supports version 8.",
  );
  await expect(page.locator(`${stage} iframe`)).toHaveCount(0);
  await modeButton(page, "Current").click();
  await expect(page.locator("[data-current-screen]")).toBeVisible();
});
