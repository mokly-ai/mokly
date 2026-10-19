/**
 * Expired generations in Serve. A generation expires after 60 idle seconds,
 * which a browser spec cannot wait for, so `page.route` answers the next
 * renewal with 404, the response of a collected generation. The shell must
 * then reacquire the comparison or preview before it shows the new view.
 */

import { expect, type Page } from "@playwright/test";

import { modeButton } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  generationOf,
  loadComparison,
  PANE_SOURCE,
  selectedRequests,
} from "./serve_comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

const after = ".mb-pane--after iframe";
const before = ".mb-pane--before iframe";
const stage = "[data-mokly-preview]";

/** Answer the next renewal of `review` with 404, as a collected generation does. */
async function expireOnRenewal(page: Page, review: string): Promise<void> {
  let expired = false;
  await page.route(review, async (route) => {
    if (route.request().method() !== "HEAD" || expired) {
      await route.continue();
      return;
    }
    expired = true;
    await route.fulfill({ status: 404 });
  });
}

/** Every snapshot response that failed while the spec ran. */
function failedSnapshots(page: Page): string[] {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/snapshots/") && !response.ok())
      failed.push(response.url());
  });
  return failed;
}

for (const change of ["theme", "viewport"] as const)
  test(`an idle Difference recovers expired snapshots before changing ${change}`, async ({
    page,
    changes,
    allowBrowserError,
  }) => {
    const changed = changes.paths.changed;
    const requests = selectedRequests(page);
    const failed = failedSnapshots(page);
    await page.goto(`/view/${changed}/`);
    await chooseViewport(page, "desktop");
    await chooseScheme(page, "light");
    await loadComparison(page, "Overlay");
    await modeButton(page, "Difference").click();
    await expect(page.frameLocator(before).locator("h1")).toHaveText(
      "Before screen",
    );
    await expect(page.frameLocator(after).locator("h1")).toHaveText(
      "After screen",
    );
    await expect(page.locator("[data-diff-stage]")).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
    const review = `${generationOf((await page.locator(after).getAttribute(PANE_SOURCE))!)}review.json`;
    allowBrowserError(
      responseFailure(changes.url, new URL(review).pathname, 404),
    );
    await expireOnRenewal(page, review);

    if (change === "theme") await chooseScheme(page, "dark");
    else await chooseViewport(page, "mobile");

    await expect(page.locator(after)).toHaveAttribute(
      PANE_SOURCE,
      change === "theme" ? /\.desktop\.dark\.html$/u : /\.mobile\.html$/u,
    );
    await expect(page.frameLocator(before).locator("h1")).toHaveText(
      "Before screen",
    );
    await expect(page.frameLocator(after).locator("h1")).toHaveText(
      "After screen",
    );
    await expect(page.locator(".mb-panes")).toHaveAttribute(
      "data-compare-mode",
      "difference",
    );
    expect(requests).toHaveLength(2);
    expect(requests[1]!.searchParams.get("path")).toBe(changed);
    expect(requests[1]!.searchParams.has("refresh")).toBe(false);
    expect(failed).toEqual([]);
  });

test("snapshot recovery keeps the selected saved variant", async ({
  page,
  changes,
  allowBrowserError,
}) => {
  const variant = "branch/consumers/badge/default";
  const requests = selectedRequests(page);
  await page.goto(`/view/${variant}/`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Side by side");
  await expect(page.frameLocator(after).locator(".branch-badge")).toHaveText(
    "After Active",
  );
  const review = `${generationOf((await page.locator(after).getAttribute(PANE_SOURCE))!)}review.json`;
  allowBrowserError(
    responseFailure(changes.url, new URL(review).pathname, 404),
  );
  await expireOnRenewal(page, review);
  await chooseViewport(page, "mobile");
  await expect(page.locator(after)).toHaveAttribute(
    PANE_SOURCE,
    /\.mobile\.html$/u,
  );
  await expect(page.frameLocator(before).locator(".branch-badge")).toHaveText(
    "Before Active",
  );
  await expect(page.frameLocator(after).locator(".branch-badge")).toHaveText(
    "After Active",
  );
  expect(requests).toHaveLength(2);
  expect(requests[1]!.searchParams.get("path")).toBe(variant);
  expect(requests[1]!.searchParams.size).toBe(1);
});

for (const change of ["scheme", "viewport"] as const)
  test(`an expired preview is reacquired before changing the ${change}`, async ({
    page,
    changes,
    allowBrowserError,
  }) => {
    const index = await changes.index();
    const record = index.removedEntries.find(
      ({ entry }) => entry.path === changes.paths.removedScreen,
    )!;
    const review = new URL(index.comparisonUrl!, changes.url).href;
    allowBrowserError(
      responseFailure(changes.url, new URL(review).pathname, 404),
    );
    const selections = selectedRequests(page);
    const failed = failedSnapshots(page);
    await page.goto(
      `/view/${record.entry.path}/?snapshot=${record.snapshotId}&viewport=desktop`,
    );
    const desktop = page.locator(`${stage} .mbk-frame-desktop iframe`);
    await expect(desktop.contentFrame().locator("h1")).toHaveText(
      "Historical screen",
    );
    const expired = (await desktop.getAttribute(PANE_SOURCE))!;
    const metadata: string[] = [];
    page.on("request", (request) => {
      if (request.url() === review) metadata.push(request.method());
    });
    await expireOnRenewal(page, review);

    if (change === "scheme") await chooseScheme(page, "dark");
    else await chooseViewport(page, "mobile");

    const renewed = page.locator(
      `${stage} .mbk-frame-${change === "scheme" ? "desktop" : "mobile"} iframe`,
    );
    await expect(renewed).toHaveAttribute(
      PANE_SOURCE,
      change === "scheme" ? /\.desktop\.dark\.html$/u : /\.mobile\.html$/u,
    );
    await expect(renewed.contentFrame().locator("h1")).toHaveText(
      "Historical screen",
    );
    await expect(renewed).not.toHaveAttribute(PANE_SOURCE, expired);
    expect(metadata).toEqual(["HEAD", "GET"]);
    expect(selections).toEqual([]);
    expect(failed).toEqual([]);
  });
