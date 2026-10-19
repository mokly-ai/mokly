/**
 * A removed screen's snapshot across provider-normalized URLs on the copied
 * comparison output, under the shell destination contract. The host serves
 * each route's document for its extensionless address. The shell opens the
 * removed record from that address, writes the canonical address, and keeps
 * the record through a move to current content, Back, Forward, and a
 * reload. A current path with that snapshot is unavailable through the
 * error state and shows no historical content.
 */

import { expect, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  chooseFilter,
  comparisonIndex,
  navRow,
  snapshotOf,
} from "./comparison_ui.js";

const previousPath = comparisonPaths.removedScreen;
const currentPath = comparisonPaths.added;

/** The removed screen's previous version, current in the navigation. */
async function expectHistorical(page: Page): Promise<void> {
  await expect(page.locator("#mb-main .mbk-screen-head h2")).toHaveText(
    "Retired screen",
  );
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(navRow(page, previousPath)).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  for (const viewport of ["mobile", "desktop"] as const)
    await expect(
      page
        .frameLocator(`[data-mokly-preview] .mbk-frame-${viewport} iframe`)
        .locator("h1"),
    ).toHaveText("Historical screen");
  await expect(page.locator("[data-workspace-highlight]")).toBeDisabled();
}

test("screen preserves its snapshot through provider-normalized URLs", async ({
  page,
  request,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // The provider serves every route's document for its extensionless address.
  await page.route(`${baseURL}/view/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/index.html")) return route.continue();
    url.pathname = `${url.pathname.replace(/\/$/u, "")}/index.html`;
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  });
  const snapshot = snapshotOf(
    await comparisonIndex(request, baseURL),
    previousPath,
  );
  const previousUrl = `${baseURL}/view/${previousPath}/?snapshot=${snapshot}`;
  const currentUrl = `${baseURL}/view/${currentPath}/`;
  await page.goto(`${baseURL}/view/${previousPath}?snapshot=${snapshot}`);
  await expect(page).toHaveURL(previousUrl);
  await expectHistorical(page);

  await chooseFilter(page, "changed");
  await navRow(page, currentPath).click();
  await expect(page).toHaveURL(currentUrl);
  await expect(page.locator("#mb-main .mbk-screen-head h2")).toHaveText(
    "Added screen",
  );
  await expect(page.locator("[data-mokly-preview]")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(previousUrl);
  await expectHistorical(page);
  await page.goForward();
  await expect(page).toHaveURL(currentUrl);
  await page.goBack();
  await page.reload();
  await expect(page).toHaveURL(previousUrl);
  await expectHistorical(page);
  expect(errors).toEqual([]);

  // A current path with the removed record's snapshot is unavailable through
  // the error state, and shows nothing of either entry.
  await page.goto(`${currentUrl}?snapshot=${snapshot}`);
  await expect(page.locator("#mb-main .mbk-empty h2")).toHaveText(
    "Item not found",
  );
  await expect(page.locator("[data-mokly-preview] iframe")).toHaveCount(0);
  await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
  await expect(page.locator("#mb-main")).not.toContainText("Added screen");
});
