/**
 * A removed entry's snapshot across provider-normalized URLs on the copied
 * comparison output, under the shell destination contract. The host serves
 * each route's document for its extensionless address. The shell opens the
 * removed record from that address, writes the canonical address, and keeps
 * the record through a move to current content, Back, Forward, and a
 * reload. A current path with that snapshot is unavailable through the
 * error state and shows no historical content. The removed screen moves to
 * the added screen; the removed page moves to a page that pairs with its own
 * base path by similar text, so that base path has no removed record.
 */

import { expect, type Page } from "@playwright/test";

import { similarTextPageBase } from "../helpers/comparison_evidence_groups.js";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  chooseFilter,
  comparisonIndex,
  navRow,
  snapshotOf,
} from "./comparison_ui.js";

/** A removed entry and the current entry that the journey moves to. */
interface HistoryCase {
  kind: "screen" | "page";
  previousPath: string;
  previousTitle: string;
  previousHeading: string;
  currentPath: string;
  currentTitle: string;
  /** The base path that the current entry pairs with by similar text. */
  pairedWith?: string;
}

const CASES: readonly HistoryCase[] = [
  {
    kind: "screen",
    previousPath: comparisonPaths.removedScreen,
    previousTitle: "Retired screen",
    previousHeading: "Historical screen",
    currentPath: comparisonPaths.added,
    currentTitle: "Added screen",
  },
  {
    kind: "page",
    previousPath: comparisonPaths.removedPage,
    previousTitle: "Retired page",
    previousHeading: "Historical page",
    currentPath: comparisonPaths.similarTextPage,
    currentTitle: "User guidebook",
    pairedWith: similarTextPageBase,
  },
];

/** The removed entry's previous version, current in the navigation. */
async function expectHistorical(page: Page, entry: HistoryCase) {
  await expect(page.locator("#mb-main .mbk-screen-head h2")).toHaveText(
    entry.previousTitle,
  );
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(navRow(page, entry.previousPath)).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
  await expect(page.locator("#mb-main .mbk-empty")).toHaveCount(0);
  if (entry.kind === "page") {
    await expect(page.locator(".mbk-entry-status")).toHaveText("Removed");
    await expect(
      page.frameLocator("[data-mokly-preview] iframe").locator("h1"),
    ).toHaveText(entry.previousHeading);
    return;
  }
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  for (const viewport of ["mobile", "desktop"] as const)
    await expect(
      page
        .frameLocator(`[data-mokly-preview] .mbk-frame-${viewport} iframe`)
        .locator("h1"),
    ).toHaveText(entry.previousHeading);
  await expect(page.locator("[data-workspace-highlight]")).toBeDisabled();
}

for (const entry of CASES)
  test(`${entry.kind} preserves its snapshot through provider-normalized URLs`, async ({
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
    const index = await comparisonIndex(request, baseURL);
    const snapshot = snapshotOf(index, entry.previousPath);
    expect(snapshot).toMatch(/^[a-f0-9]{64}$/u);
    // A pair by similar text leaves its base path no removed record.
    if (entry.pairedWith) {
      const current = index.pages?.find(
        (candidate) => candidate.path === entry.currentPath,
      );
      expect(current?.previousPath).toBe(entry.pairedWith);
      expect(
        index.removedEntries.map((record) => record.entry.path),
      ).not.toContain(entry.pairedWith);
    }
    const previousUrl = `${baseURL}/view/${entry.previousPath}/?snapshot=${snapshot}`;
    const currentUrl = `${baseURL}/view/${entry.currentPath}/`;
    await page.goto(
      `${baseURL}/view/${entry.previousPath}?snapshot=${snapshot}`,
    );
    await expect(page).toHaveURL(previousUrl);
    await expectHistorical(page, entry);

    await chooseFilter(page, "changed");
    await navRow(page, entry.currentPath).click();
    await expect(page).toHaveURL(currentUrl);
    await expect(page.locator("#mb-main .mbk-screen-head h2")).toHaveText(
      entry.currentTitle,
    );
    await expect(page.locator("[data-mokly-preview]")).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(previousUrl);
    await expectHistorical(page, entry);
    await page.goForward();
    await expect(page).toHaveURL(currentUrl);
    await page.goBack();
    await page.reload();
    await expect(page).toHaveURL(previousUrl);
    await expectHistorical(page, entry);
    expect(errors).toEqual([]);

    // A current path with the removed record's snapshot is unavailable through
    // the error state, and shows nothing of either entry.
    await page.goto(`${currentUrl}?snapshot=${snapshot}`);
    await expect(page.locator("#mb-main .mbk-empty h2")).toHaveText(
      "Item not found",
    );
    await expect(page.locator("[data-mokly-preview] iframe")).toHaveCount(0);
    await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
    await expect(page.locator("#mb-main")).not.toContainText(
      entry.currentTitle,
    );
  });
