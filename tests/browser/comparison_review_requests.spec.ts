import fs from "node:fs/promises";

import { expect, type Request } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, modeButton, navRow } from "./comparison_ui.js";
import { endedRequests, passRenderingUpdates } from "./page_settling.js";
import { responseFailure } from "./shell_error_allowances.js";

const REVIEW = "**/mokly-viewer/diffs/generations/*/review.json";
const stage = "[data-diff-stage]";

test("pending requests cannot replace Current or a newly navigated screen", async ({
  page,
}) => {
  let release = (): void => undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const heldRequests: Request[] = [];
  await page.route(REVIEW, async (route) => {
    heldRequests.push(route.request());
    const response = await route.fetch();
    await waiting;
    await route.fulfill({ response }).catch(() => undefined);
  });
  const ended = endedRequests(page);
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await modeButton(page, "Overlay").click();
  await expect(page.locator(stage)).toContainText("Loading comparison");
  // Move on only once the shell holds a request for the review.
  await expect.poll(() => heldRequests.length).toBeGreaterThan(0);
  await modeButton(page, "Current").click();
  await expect(page.locator("[data-current-screen]")).toBeVisible();
  await navRow(page, comparisonPaths.unchanged).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");
  // Release the held review, wait until the browser ends that request (the
  // shell cancels it when the reader chooses Current), then let the shell
  // handle and render the outcome.
  release();
  await expect
    .poll(() => heldRequests.every((held) => ended.has(held)))
    .toBe(true);
  await passRenderingUpdates(page);
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
