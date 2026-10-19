/**
 * Comparison eligibility in Serve: added and removed screens stay current or
 * historical without a comparison band, a removed affected consumer and a
 * stale comparison URL open its previous version, and a light-only
 * comparison under Dark keeps its Light sides and names them.
 */

import { expect, type Page } from "@playwright/test";

import {
  addViewerStateSources,
  viewerStatePaths,
} from "../helpers/viewer_state_sources.js";

import { test } from "./serve_comparison_test.js";
import { loadComparison, PANE_SOURCE } from "./serve_comparison_ui.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

test.use({ comparisonSources: { add: addViewerStateSources } });

async function expectRemovedPrevious(page: Page) {
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(
    page.locator("[data-current-screen], [data-diff-stage]"),
  ).toHaveCount(0);
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(
    page.locator("[data-mokly-preview] iframe").first(),
  ).toBeVisible();
}

test("removed affected-screen links and legacy comparison URLs stay current", async ({
  page,
  changes,
}) => {
  await page.goto(`/view/${changes.paths.component}/`);
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const removed = page
    .getByRole("region", { name: "Inspector", exact: true })
    .getByRole("link", { name: "Legacy screen · Removed", exact: true });
  await expect(removed).not.toHaveAttribute("href", /comparison=side/u);
  await removed.click();
  await expectRemovedPrevious(page);

  await page.goto(`/view/${viewerStatePaths.removedConsumer}/?comparison=side`);
  await expectRemovedPrevious(page);
});

test("added and removed screens stay current while light-only comparisons retain their sides", async ({
  page,
  changes,
}) => {
  const origin = changes.url;
  await page.goto(`/view/${changes.paths.added}/`);
  await chooseViewport(page, "mobile");
  await expect(page).toHaveURL(`${origin}/view/${changes.paths.added}/`);
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(
    page.frameLocator('[data-workspace-frame="mobile"]').locator("h1"),
  ).toHaveText("Added screen");

  const removed = (await changes.index()).removedEntries.find(
    ({ entry }) => entry.path === changes.paths.removedScreen,
  );
  expect(removed?.snapshotId).toMatch(/^[a-f0-9]{64}$/u);
  await page.goto(`/view/${changes.paths.removedScreen}/`);
  await chooseViewport(page, "mobile");
  await expect(page).toHaveURL(
    `${origin}/view/${changes.paths.removedScreen}/?snapshot=${removed!.snapshotId}`,
  );
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(
    page
      .frameLocator("[data-mokly-preview] .mbk-frame-mobile iframe")
      .locator("h1"),
  ).toHaveText("Historical screen");
  await expect(page.locator("[data-diff-stage]")).toHaveCount(0);

  await page.goto(`/view/${viewerStatePaths.lightOnlyChanged}/`);
  await chooseScheme(page, "dark");
  await expect(page.locator('[data-view-changed="scheme"]')).toBeHidden();
  await loadComparison(page, "Overlay");
  await expect(page.locator("[data-diff-viewport] h3").first()).toContainText(
    "Light only",
  );
  const frames = page.locator("[data-diff-stage] iframe");
  await expect(frames).not.toHaveCount(0);
  for (const frame of await frames.all()) {
    await expect(frame).not.toHaveAttribute(PANE_SOURCE, /\.dark\.html$/u);
    await expect(frame).toHaveCSS("color-scheme", "light");
  }
});
