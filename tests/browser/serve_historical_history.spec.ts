/**
 * A removed screen or page keeps its historical identity in Serve through
 * Changes navigation, Back, Forward, and a reload, and a snapshot query on a
 * current entry never shows historical or current content.
 */

import { expect, type Page } from "@playwright/test";

import { movedFixturePaths } from "../helpers/moved_fixture_sources.js";

import { chooseFilter, navRow } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";

/** One removed entry, the current entry beside it in Changes, and their titles. */
const HISTORY_ENTRIES = [
  {
    kind: "screen",
    previousPath: "screens/retired",
    previousTitle: "Retired screen",
    currentPath: "screens/added",
    currentTitle: "Added screen",
  },
  {
    kind: "page",
    previousPath: "pages/retired",
    previousTitle: "Retired page",
    currentPath: movedFixturePaths.movedPage,
    currentTitle: "Payment guide",
  },
] as const;

type HistoryEntry = (typeof HISTORY_ENTRIES)[number];

async function expectHistorical(page: Page, entry: HistoryEntry) {
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    entry.previousTitle,
  );
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(
    page.locator(
      `a[data-nav-row][data-route="${entry.previousPath}/index.html"]`,
    ),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
  if (entry.kind === "screen") {
    await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
    for (const viewport of ["mobile", "desktop"] as const)
      await expect(
        page
          .frameLocator(`[data-mokly-preview] .mbk-frame-${viewport} iframe`)
          .locator("h1"),
      ).toHaveText("Historical screen");
    await expect(page.locator("[data-workspace-highlight]")).toBeDisabled();
  } else {
    await expect(page.locator(".mbk-entry-status")).toHaveText("Removed");
    await expect(
      page.frameLocator("[data-mokly-preview] iframe").locator("h1"),
    ).toHaveText("Historical page");
  }
  await expect(page.locator("#mb-main .mbk-stage .mbk-empty")).toHaveCount(0);
}

for (const entry of HISTORY_ENTRIES)
  test(`${entry.kind} keeps its historical identity through Back, Forward and refresh`, async ({
    page,
    changes,
  }) => {
    const snapshotId = (await changes.index()).removedEntries.find(
      (record) => record.entry.path === entry.previousPath,
    )?.snapshotId;
    expect(snapshotId).toMatch(/^[a-f0-9]{64}$/u);
    const origin = changes.url;
    const previousUrl = `${origin}/view/${entry.previousPath}/?snapshot=${snapshotId!}`;
    const currentUrl = `${origin}/view/${entry.currentPath}/`;
    const heading = page.locator("#mb-main h2").first();
    await page.goto(currentUrl);
    await expect(heading).toHaveText(entry.currentTitle);
    await chooseFilter(page, "changed");
    await navRow(page, entry.previousPath).click();
    await expect(page).toHaveURL(previousUrl);
    await expectHistorical(page, entry);
    await navRow(page, entry.currentPath).click();
    await expect(page).toHaveURL(currentUrl);
    await expect(heading).toHaveText(entry.currentTitle);
    await expect(page.locator("[data-mokly-preview]")).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(previousUrl);
    await expectHistorical(page, entry);
    await page.goForward();
    await expect(page).toHaveURL(currentUrl);
    await expect(heading).toHaveText(entry.currentTitle);
    await page.goBack();
    await page.reload();
    await expect(page).toHaveURL(previousUrl);
    await expectHistorical(page, entry);

    await page.goto(`${currentUrl}?snapshot=${snapshotId!}`);
    await expect(
      page.getByRole("heading", { name: "Item not found", exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-mokly-preview] iframe")).toHaveCount(0);
    await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
    await expect(page.locator("#mb-main")).not.toContainText(
      entry.currentTitle,
    );
  });
